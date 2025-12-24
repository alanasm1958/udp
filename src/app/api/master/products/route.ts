/**
 * /api/master/products
 *
 * CRUD endpoints for product master data.
 * Products represent goods and services.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { products, productIdentifiers, uoms, taxCategories, parties } from "@/db/schema";
import { eq, and, ilike, or } from "drizzle-orm";
import {
  requireTenantIdFromHeaders,
  getUserIdFromHeaders,
  getActorIdFromHeaders,
  TenantError,
} from "@/lib/tenant";
import { resolveActor } from "@/lib/actor";
import { createAuditContext } from "@/lib/audit";

// Request types
interface ProductIdentifierInput {
  type: "barcode" | "external" | "supplier" | "other";
  value: string;
  isPrimary?: boolean;
}

interface CreateProductRequest {
  name: string;
  type: "good" | "service";
  sku?: string;
  description?: string;
  defaultUomCode?: string;
  taxCategoryCode?: string;
  defaultSalesPrice?: string | number;
  defaultPurchaseCost?: string | number;
  preferredVendorPartyId?: string;
  identifiers?: ProductIdentifierInput[];
  metadata?: Record<string, unknown>;
}

// Validate UUID format
function isValidUuid(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

/**
 * GET /api/master/products
 * List products with optional filters
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const url = new URL(req.url);

    const typeFilter = url.searchParams.get("type");
    const searchQuery = url.searchParams.get("q");
    const limitParam = url.searchParams.get("limit");
    const limit = Math.min(Math.max(parseInt(limitParam || "50", 10) || 50, 1), 200);

    const conditions = [eq(products.tenantId, tenantId)];

    if (typeFilter && (typeFilter === "good" || typeFilter === "service")) {
      conditions.push(eq(products.type, typeFilter));
    }

    if (searchQuery) {
      const searchPattern = `%${searchQuery}%`;
      conditions.push(
        or(
          ilike(products.name, searchPattern),
          ilike(products.sku, searchPattern)
        )!
      );
    }

    const productList = await db
      .select({
        id: products.id,
        sku: products.sku,
        name: products.name,
        type: products.type,
        status: products.status,
        defaultSalesPrice: products.defaultSalesPrice,
        defaultPurchaseCost: products.defaultPurchaseCost,
        createdAt: products.createdAt,
      })
      .from(products)
      .where(and(...conditions))
      .limit(limit);

    return NextResponse.json({ items: productList });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("GET /api/master/products error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/master/products
 * Create a new product with optional identifiers
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const userIdFromHeader = getUserIdFromHeaders(req);
    const actorIdFromHeader = getActorIdFromHeaders(req);

    const actor = await resolveActor(tenantId, actorIdFromHeader, userIdFromHeader);
    const audit = createAuditContext(tenantId, actor.actorId);

    const body: CreateProductRequest = await req.json();

    // Validate required fields
    if (!body.name || !body.type) {
      return NextResponse.json(
        { error: "name and type are required" },
        { status: 400 }
      );
    }

    if (body.type !== "good" && body.type !== "service") {
      return NextResponse.json(
        { error: "type must be 'good' or 'service'" },
        { status: 400 }
      );
    }

    // Check SKU uniqueness if provided
    if (body.sku) {
      const existingSku = await db
        .select({ id: products.id })
        .from(products)
        .where(and(eq(products.tenantId, tenantId), eq(products.sku, body.sku)))
        .limit(1);

      if (existingSku.length > 0) {
        return NextResponse.json(
          { error: `SKU '${body.sku}' already exists` },
          { status: 409 }
        );
      }
    }

    // Resolve UOM if provided
    let defaultUomId: string | null = null;
    if (body.defaultUomCode) {
      const [existingUom] = await db
        .select({ id: uoms.id })
        .from(uoms)
        .where(and(eq(uoms.tenantId, tenantId), eq(uoms.code, body.defaultUomCode)));

      if (existingUom) {
        defaultUomId = existingUom.id;
      } else {
        // Create UOM on the fly
        const [newUom] = await db
          .insert(uoms)
          .values({
            tenantId,
            code: body.defaultUomCode,
            name: body.defaultUomCode,
            createdByActorId: actor.actorId,
          })
          .returning();
        defaultUomId = newUom.id;
        await audit.log("uom", newUom.id, "uom_created", {
          code: body.defaultUomCode,
          autoCreated: true,
        });
      }
    }

    // Resolve tax category if provided
    let taxCategoryId: string | null = null;
    if (body.taxCategoryCode) {
      const [existingTaxCat] = await db
        .select({ id: taxCategories.id })
        .from(taxCategories)
        .where(and(eq(taxCategories.tenantId, tenantId), eq(taxCategories.code, body.taxCategoryCode)));

      if (existingTaxCat) {
        taxCategoryId = existingTaxCat.id;
      } else {
        // Create tax category on the fly
        const [newTaxCat] = await db
          .insert(taxCategories)
          .values({
            tenantId,
            code: body.taxCategoryCode,
            name: body.taxCategoryCode,
            createdByActorId: actor.actorId,
          })
          .returning();
        taxCategoryId = newTaxCat.id;
        await audit.log("tax_category", newTaxCat.id, "tax_category_created", {
          code: body.taxCategoryCode,
          autoCreated: true,
        });
      }
    }

    // Validate preferred vendor if provided
    if (body.preferredVendorPartyId) {
      if (!isValidUuid(body.preferredVendorPartyId)) {
        return NextResponse.json(
          { error: "Invalid preferredVendorPartyId format" },
          { status: 400 }
        );
      }
      const [vendor] = await db
        .select({ id: parties.id })
        .from(parties)
        .where(
          and(
            eq(parties.tenantId, tenantId),
            eq(parties.id, body.preferredVendorPartyId)
          )
        );
      if (!vendor) {
        return NextResponse.json(
          { error: "Preferred vendor party not found" },
          { status: 404 }
        );
      }
    }

    // Create product
    const [product] = await db
      .insert(products)
      .values({
        tenantId,
        name: body.name,
        type: body.type,
        sku: body.sku ?? null,
        description: body.description ?? null,
        defaultUomId,
        taxCategoryId,
        defaultSalesPrice: String(body.defaultSalesPrice ?? "0"),
        defaultPurchaseCost: String(body.defaultPurchaseCost ?? "0"),
        preferredVendorPartyId: body.preferredVendorPartyId ?? null,
        metadata: body.metadata ?? {},
        createdByActorId: actor.actorId,
      })
      .returning();

    await audit.log("product", product.id, "product_created", {
      name: body.name,
      type: body.type,
      sku: body.sku,
    });

    // Create identifiers if provided
    if (body.identifiers && body.identifiers.length > 0) {
      for (const identifier of body.identifiers) {
        // Check for duplicate identifier
        const [existing] = await db
          .select({ id: productIdentifiers.id })
          .from(productIdentifiers)
          .where(
            and(
              eq(productIdentifiers.tenantId, tenantId),
              eq(productIdentifiers.identifierType, identifier.type),
              eq(productIdentifiers.identifierValue, identifier.value)
            )
          );

        if (existing) {
          return NextResponse.json(
            { error: `Identifier ${identifier.type}:${identifier.value} already exists` },
            { status: 409 }
          );
        }

        const [created] = await db
          .insert(productIdentifiers)
          .values({
            tenantId,
            productId: product.id,
            identifierType: identifier.type,
            identifierValue: identifier.value,
            isPrimary: identifier.isPrimary ?? false,
            createdByActorId: actor.actorId,
          })
          .returning();

        await audit.log("product_identifier", created.id, "product_identifier_created", {
          productId: product.id,
          type: identifier.type,
          value: identifier.value,
        });
      }
    }

    return NextResponse.json({ productId: product.id }, { status: 201 });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("POST /api/master/products error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
