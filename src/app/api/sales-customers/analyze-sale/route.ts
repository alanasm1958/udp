/**
 * /api/sales-customers/analyze-sale
 *
 * AI-powered sale/lead analysis endpoint
 * POST: Analyze a potential sale and generate quote recommendations
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { items, aiUsageDaily } from "@/db/schema";
import { eq, sql, ilike, or } from "drizzle-orm";
import {
  requireTenantIdFromHeaders,
  getUserIdFromHeaders,
  TenantError,
} from "@/lib/tenant";
import { canUseAI } from "@/lib/entitlements";
import { getAIProvider } from "@/lib/ai/provider";

interface AnalyzeRequest {
  // Lead/Customer info
  name?: string;
  email?: string;
  phone?: string;
  company?: string;
  industry?: string;
  companySize?: string;
  // Opportunity info
  budget?: string;
  timeline?: string;
  requirements?: string;
  painPoints?: string;
  currentSolution?: string;
  decisionMakers?: string;
  source?: string;
  notes?: string;
}

interface RecommendedItem {
  itemId: string | null;
  name: string;
  description: string;
  type: "product" | "service" | "consumable";
  quantity: number;
  unitPrice: number;
  rationale: string;
}

interface AnalysisResult {
  summary: string;
  leadScore: number; // 0-100
  leadScoreRationale: string;
  winProbability: number; // 0-100
  recommendedApproach: string;
  keyInsights: string[];
  potentialChallenges: string[];
  suggestedNextSteps: string[];
  recommendedItems: RecommendedItem[];
  estimatedDealValue: number;
  estimatedCloseDate: string;
  competitorRisks?: string[];
}

const ANALYSIS_SYSTEM_PROMPT = `You are a sales analysis AI assistant for a B2B business platform. Your role is to analyze potential sales opportunities and provide actionable recommendations.

When analyzing a lead or sale opportunity, you should:
1. Assess the lead quality and likelihood to close
2. Identify the customer's needs based on their requirements and pain points
3. Recommend specific products/services that match their needs
4. Provide strategic guidance on how to approach the sale
5. Identify potential challenges and how to overcome them

Always provide structured, actionable recommendations that can be converted into a quote.

IMPORTANT: When recommending items, suggest realistic quantities and prices based on the customer's stated budget and requirements. If no budget is provided, estimate based on industry standards.

Your response MUST be valid JSON matching this structure:
{
  "summary": "Brief 2-3 sentence executive summary of the opportunity",
  "leadScore": <number 0-100>,
  "leadScoreRationale": "Explanation of the lead score",
  "winProbability": <number 0-100>,
  "recommendedApproach": "Strategic approach to win this deal",
  "keyInsights": ["insight1", "insight2", ...],
  "potentialChallenges": ["challenge1", "challenge2", ...],
  "suggestedNextSteps": ["step1", "step2", ...],
  "recommendedItems": [
    {
      "name": "Product/Service Name",
      "description": "Brief description of what this is",
      "type": "product|service|consumable",
      "quantity": <number>,
      "unitPrice": <number>,
      "rationale": "Why this item is recommended for this customer"
    }
  ],
  "estimatedDealValue": <number>,
  "estimatedCloseDate": "YYYY-MM-DD",
  "competitorRisks": ["risk1", "risk2", ...]
}`;

/**
 * POST /api/sales-customers/analyze-sale
 * Analyze a potential sale and generate quote recommendations
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const userId = getUserIdFromHeaders(req);

    if (!userId) {
      return NextResponse.json({ error: "User not authenticated" }, { status: 401 });
    }

    // Check AI entitlement
    const canUse = await canUseAI(tenantId);
    if (!canUse) {
      return NextResponse.json(
        { error: "AI Copilot is not available on your plan" },
        { status: 403 }
      );
    }

    const body: AnalyzeRequest = await req.json();

    // Get available items/products from the tenant's catalog for context
    const availableItems = await db
      .select({
        id: items.id,
        name: items.name,
        description: items.description,
        type: items.type,
        defaultSalesPrice: items.defaultSalesPrice,
      })
      .from(items)
      .where(eq(items.tenantId, tenantId))
      .limit(50);

    // Build context for the AI
    const leadContext = `
## Lead/Customer Information
- Name: ${body.name || "Not provided"}
- Company: ${body.company || "Not provided"}
- Industry: ${body.industry || "Not provided"}
- Company Size: ${body.companySize || "Not provided"}
- Email: ${body.email || "Not provided"}
- Phone: ${body.phone || "Not provided"}
- Source: ${body.source || "Not provided"}

## Opportunity Details
- Budget: ${body.budget || "Not specified"}
- Timeline: ${body.timeline || "Not specified"}
- Requirements: ${body.requirements || "Not specified"}
- Pain Points: ${body.painPoints || "Not specified"}
- Current Solution: ${body.currentSolution || "Not specified"}
- Decision Makers: ${body.decisionMakers || "Not specified"}
- Additional Notes: ${body.notes || "None"}

## Available Products/Services (from our catalog)
${availableItems.length > 0
  ? availableItems.map(item =>
      `- ${item.name} (${item.type}): ${item.description || "No description"} - $${item.defaultSalesPrice || "Price varies"}`
    ).join("\n")
  : "No items in catalog yet. Please recommend generic items that would typically match these requirements."
}

Please analyze this opportunity and provide recommendations. If specific items from our catalog match the customer's needs, include their exact names. Otherwise, suggest appropriate items that should be added to the catalog.
`;

    const provider = getAIProvider();

    const response = await provider.complete({
      messages: [
        { role: "system", content: ANALYSIS_SYSTEM_PROMPT },
        { role: "user", content: leadContext },
      ],
      maxTokens: 2000,
      temperature: 0.7,
    });

    // Track AI usage
    const today = new Date().toISOString().split("T")[0];
    await db
      .insert(aiUsageDaily)
      .values({
        tenantId,
        date: today,
        requests: 1,
        tokensIn: response.usage?.promptTokens || 0,
        tokensOut: response.usage?.completionTokens || 0,
      })
      .onConflictDoUpdate({
        target: [aiUsageDaily.tenantId, aiUsageDaily.date],
        set: {
          requests: sql`${aiUsageDaily.requests} + 1`,
          tokensIn: sql`${aiUsageDaily.tokensIn} + ${response.usage?.promptTokens || 0}`,
          tokensOut: sql`${aiUsageDaily.tokensOut} + ${response.usage?.completionTokens || 0}`,
          updatedAt: new Date(),
        },
      });

    // Parse the AI response
    let analysis: AnalysisResult;
    try {
      // Try to extract JSON from the response
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysis = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No JSON found in response");
      }
    } catch {
      // If parsing fails, create a fallback response
      analysis = createFallbackAnalysis(body, availableItems);
    }

    // Try to match recommended items to actual catalog items
    const enrichedItems = await Promise.all(
      analysis.recommendedItems.map(async (item) => {
        // Try to find matching item in catalog
        const matchingItems = await db
          .select({
            id: items.id,
            name: items.name,
            type: items.type,
            defaultSalesPrice: items.defaultSalesPrice,
          })
          .from(items)
          .where(
            and(
              eq(items.tenantId, tenantId),
              or(
                ilike(items.name, `%${item.name}%`),
                ilike(items.name, `%${item.name.split(" ")[0]}%`)
              )
            )
          )
          .limit(1);

        if (matchingItems.length > 0) {
          const match = matchingItems[0];
          return {
            ...item,
            itemId: match.id,
            name: match.name,
            unitPrice: item.unitPrice || parseFloat(match.defaultSalesPrice || "0"),
          };
        }

        return {
          ...item,
          itemId: null,
        };
      })
    );

    analysis.recommendedItems = enrichedItems;

    return NextResponse.json({
      analysis,
      usage: response.usage,
    });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("POST /api/sales-customers/analyze-sale error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

// Helper to import 'and' from drizzle
import { and } from "drizzle-orm";

/**
 * Create a fallback analysis when AI response can't be parsed
 */
function createFallbackAnalysis(
  body: AnalyzeRequest,
  availableItems: Array<{
    id: string;
    name: string;
    description: string | null;
    type: string;
    defaultSalesPrice: string | null;
  }>
): AnalysisResult {
  const budget = parseFloat(body.budget?.replace(/[^0-9.]/g, "") || "0");
  const hasRequirements = !!body.requirements;
  const hasCompany = !!body.company;
  const hasBudget = budget > 0;

  // Calculate lead score based on available info
  let leadScore = 50;
  if (hasCompany) leadScore += 10;
  if (hasBudget) leadScore += 15;
  if (hasRequirements) leadScore += 15;
  if (body.timeline) leadScore += 10;

  // Select items from catalog that might match
  const recommendedItems: RecommendedItem[] = availableItems.slice(0, 3).map((item) => ({
    itemId: item.id,
    name: item.name,
    description: item.description || "Standard offering",
    type: (item.type as "product" | "service" | "consumable") || "service",
    quantity: 1,
    unitPrice: parseFloat(item.defaultSalesPrice || "0") || 1000,
    rationale: "Recommended based on customer requirements",
  }));

  // If no items in catalog, suggest generic ones
  if (recommendedItems.length === 0) {
    recommendedItems.push({
      itemId: null,
      name: "Consulting Services",
      description: "Professional consulting and implementation services",
      type: "service",
      quantity: 10,
      unitPrice: 150,
      rationale: "Professional services to address customer needs",
    });
  }

  const estimatedDealValue = recommendedItems.reduce(
    (sum, item) => sum + item.quantity * item.unitPrice,
    0
  );

  const closeDate = new Date();
  closeDate.setMonth(closeDate.getMonth() + 2);

  return {
    summary: `Opportunity with ${body.company || body.name || "potential customer"}. ${
      hasRequirements ? "Clear requirements identified." : "Further discovery needed."
    } ${hasBudget ? `Budget of ${body.budget} available.` : "Budget not yet confirmed."}`,
    leadScore,
    leadScoreRationale: `Score based on: ${hasCompany ? "Company identified" : "No company"}, ${
      hasBudget ? "Budget confirmed" : "No budget"
    }, ${hasRequirements ? "Requirements clear" : "Requirements unclear"}`,
    winProbability: Math.min(leadScore - 10, 80),
    recommendedApproach:
      "Schedule a discovery call to understand specific needs and demonstrate relevant solutions.",
    keyInsights: [
      hasRequirements
        ? "Customer has clear requirements"
        : "Discovery call needed to clarify requirements",
      hasBudget ? "Budget is available" : "Need to establish budget expectations",
      body.timeline ? `Timeline: ${body.timeline}` : "Timeline not yet established",
    ],
    potentialChallenges: [
      !hasBudget ? "Budget not confirmed - may need approval process" : "",
      !body.decisionMakers ? "Decision makers not identified" : "",
      body.currentSolution ? "Existing solution in place - need to demonstrate clear value" : "",
    ].filter(Boolean),
    suggestedNextSteps: [
      "Schedule discovery call",
      "Prepare tailored demo based on requirements",
      "Send preliminary quote for review",
      "Identify all stakeholders and decision makers",
    ],
    recommendedItems,
    estimatedDealValue,
    estimatedCloseDate: closeDate.toISOString().split("T")[0],
    competitorRisks: body.currentSolution
      ? ["Incumbent solution may have switching cost advantages"]
      : [],
  };
}
