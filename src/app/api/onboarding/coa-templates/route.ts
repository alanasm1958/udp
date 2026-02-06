/**
 * /api/onboarding/coa-templates
 *
 * GET: List available Chart of Accounts templates
 */

import { NextRequest, NextResponse } from "next/server";
import { requireTenantIdFromHeaders, TenantError } from "@/lib/tenant";
import { getCoATemplateList, getCoATemplate } from "@/lib/coa-templates";

/**
 * GET /api/onboarding/coa-templates
 * Query params:
 *   - id: (optional) Get specific template with full account list
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    // Require auth but don't need tenant ID for templates
    requireTenantIdFromHeaders(req);

    const { searchParams } = new URL(req.url);
    const templateId = searchParams.get("id");

    if (templateId) {
      // Return specific template with full accounts
      const template = getCoATemplate(templateId);
      if (!template) {
        return NextResponse.json({ error: "Template not found" }, { status: 404 });
      }
      return NextResponse.json(template);
    }

    // Return list of templates (without full account details)
    const templates = getCoATemplateList();
    return NextResponse.json({ templates });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("GET /api/onboarding/coa-templates error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
