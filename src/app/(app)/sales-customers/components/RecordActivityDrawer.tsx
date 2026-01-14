"use client";

import * as React from "react";
import {
  GlassCard,
  GlassButton,
  GlassInput,
  GlassTextarea,
  SlideOver,
  Spinner,
  useToast,
} from "@/components/ui/glass";
import { apiGet, apiPost, formatCurrency } from "@/lib/http";
import {
  Phone,
  Mail,
  Users,
  MapPin,
  FileText,
  Send,
  Clock,
  Truck,
  CheckCircle,
  AlertTriangle,
  Trophy,
  XCircle,
  StickyNote,
  ArrowLeft,
  ChevronRight,
  Sparkles,
  DollarSign,
  UserPlus,
  Handshake,
  Calendar,
} from "lucide-react";

/* =============================================================================
   TYPES
   ============================================================================= */

interface Item {
  id: string;
  name: string;
  sku: string | null;
  type: "product" | "service" | "consumable" | "asset";
  defaultSalesPrice: string | null;
  defaultPurchaseCost: string | null;
}

interface Customer {
  id: string;
  name: string;
  code: string;
}

interface Salesperson {
  id: string;
  name: string;
  email: string | null;
}

interface Party {
  id: string;
  name: string;
  code: string;
  type: string;
}

interface Lead {
  id: string;
  name: string;
  email: string | null;
  status: string;
}

interface LineItem {
  id: string;
  itemId: string;
  itemName: string;
  itemType: string;
  description: string;
  quantity: number;
  unitPrice: number;
  cost: number;
  discountPercent: number;
  taxAmount: number;
  lineTotal: number;
}

type ActivityType =
  | "phone_call"
  | "email_sent"
  | "email_received"
  | "meeting"
  | "site_visit"
  | "quote_sent"
  | "quote_followed_up"
  | "order_received"
  | "order_confirmed"
  | "delivery_scheduled"
  | "delivery_completed"
  | "payment_reminder_sent"
  | "customer_issue"
  | "deal_won"
  | "deal_lost"
  | "note";

type DrawerStep =
  | "menu"
  // Communication
  | "log-phone-call"
  | "log-email-sent"
  | "log-email-received"
  | "log-meeting"
  | "log-site-visit"
  // Sales Process
  | "send-quote"
  | "follow-up-quote"
  | "record-order"
  | "confirm-order"
  // Fulfillment
  | "schedule-delivery"
  | "complete-delivery"
  | "send-payment-reminder"
  // Customer Management
  | "log-customer-issue"
  | "record-deal-won"
  | "record-deal-lost"
  | "add-note"
  // Legacy document flows
  | "make-sale"
  | "create-quote"
  | "add-customer"
  | "add-salesperson"
  | "add-partner"
  | "analyze-lead";

/* =============================================================================
   ACTIVITY CATEGORIES
   ============================================================================= */

const activityCategories = [
  {
    id: "communication",
    label: "Communication",
    description: "Log calls, emails, and meetings",
    icon: <Phone className="w-5 h-5" />,
    color: "text-blue-400",
    activities: [
      {
        id: "log-phone-call" as DrawerStep,
        label: "Log Phone Call",
        description: "Record a phone conversation with customer or lead",
        icon: <Phone className="w-5 h-5" />,
        color: "border-blue-500/30 bg-blue-500/10 hover:bg-blue-500/20",
        activityType: "phone_call" as ActivityType,
      },
      {
        id: "log-email-sent" as DrawerStep,
        label: "Log Email Sent",
        description: "Record an email you sent to customer or lead",
        icon: <Send className="w-5 h-5" />,
        color: "border-cyan-500/30 bg-cyan-500/10 hover:bg-cyan-500/20",
        activityType: "email_sent" as ActivityType,
      },
      {
        id: "log-email-received" as DrawerStep,
        label: "Log Email Received",
        description: "Record an email received from customer or lead",
        icon: <Mail className="w-5 h-5" />,
        color: "border-teal-500/30 bg-teal-500/10 hover:bg-teal-500/20",
        activityType: "email_received" as ActivityType,
      },
      {
        id: "log-meeting" as DrawerStep,
        label: "Log Meeting",
        description: "Record an in-person or virtual meeting",
        icon: <Users className="w-5 h-5" />,
        color: "border-purple-500/30 bg-purple-500/10 hover:bg-purple-500/20",
        activityType: "meeting" as ActivityType,
      },
      {
        id: "log-site-visit" as DrawerStep,
        label: "Log Site Visit",
        description: "Record a visit to customer's location",
        icon: <MapPin className="w-5 h-5" />,
        color: "border-violet-500/30 bg-violet-500/10 hover:bg-violet-500/20",
        activityType: "site_visit" as ActivityType,
      },
    ],
  },
  {
    id: "sales-process",
    label: "Sales Process",
    description: "Quotes, orders, and deals",
    icon: <FileText className="w-5 h-5" />,
    color: "text-green-400",
    activities: [
      {
        id: "create-quote" as DrawerStep,
        label: "Create Quote",
        description: "Create a new price quote for a customer",
        icon: <FileText className="w-5 h-5" />,
        color: "border-green-500/30 bg-green-500/10 hover:bg-green-500/20",
      },
      {
        id: "follow-up-quote" as DrawerStep,
        label: "Follow Up on Quote",
        description: "Log a follow-up on a sent quote",
        icon: <Clock className="w-5 h-5" />,
        color: "border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20",
        activityType: "quote_followed_up" as ActivityType,
      },
      {
        id: "make-sale" as DrawerStep,
        label: "Make a Sale (Invoice)",
        description: "Create an invoice for a completed sale",
        icon: <DollarSign className="w-5 h-5" />,
        color: "border-lime-500/30 bg-lime-500/10 hover:bg-lime-500/20",
      },
      {
        id: "record-deal-won" as DrawerStep,
        label: "Record Deal Won",
        description: "Celebrate a closed deal and log the win",
        icon: <Trophy className="w-5 h-5" />,
        color: "border-yellow-500/30 bg-yellow-500/10 hover:bg-yellow-500/20",
        activityType: "deal_won" as ActivityType,
      },
      {
        id: "record-deal-lost" as DrawerStep,
        label: "Record Deal Lost",
        description: "Log a lost deal with reasons",
        icon: <XCircle className="w-5 h-5" />,
        color: "border-red-500/30 bg-red-500/10 hover:bg-red-500/20",
        activityType: "deal_lost" as ActivityType,
      },
    ],
  },
  {
    id: "fulfillment",
    label: "Fulfillment & Payments",
    description: "Deliveries and payment tracking",
    icon: <Truck className="w-5 h-5" />,
    color: "text-orange-400",
    activities: [
      {
        id: "schedule-delivery" as DrawerStep,
        label: "Schedule Delivery",
        description: "Schedule a delivery date for an order",
        icon: <Calendar className="w-5 h-5" />,
        color: "border-orange-500/30 bg-orange-500/10 hover:bg-orange-500/20",
        activityType: "delivery_scheduled" as ActivityType,
      },
      {
        id: "complete-delivery" as DrawerStep,
        label: "Complete Delivery",
        description: "Mark a delivery as completed",
        icon: <CheckCircle className="w-5 h-5" />,
        color: "border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20",
        activityType: "delivery_completed" as ActivityType,
      },
      {
        id: "send-payment-reminder" as DrawerStep,
        label: "Send Payment Reminder",
        description: "Log a payment reminder sent to customer",
        icon: <Clock className="w-5 h-5" />,
        color: "border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20",
        activityType: "payment_reminder_sent" as ActivityType,
      },
    ],
  },
  {
    id: "customer-management",
    label: "Customer Management",
    description: "Issues, notes, and new entries",
    icon: <Users className="w-5 h-5" />,
    color: "text-purple-400",
    activities: [
      {
        id: "log-customer-issue" as DrawerStep,
        label: "Log Customer Issue",
        description: "Record a complaint or issue that needs resolution",
        icon: <AlertTriangle className="w-5 h-5" />,
        color: "border-red-500/30 bg-red-500/10 hover:bg-red-500/20",
        activityType: "customer_issue" as ActivityType,
      },
      {
        id: "add-note" as DrawerStep,
        label: "Add Note",
        description: "Add a general note to a customer or lead",
        icon: <StickyNote className="w-5 h-5" />,
        color: "border-slate-500/30 bg-slate-500/10 hover:bg-slate-500/20",
        activityType: "note" as ActivityType,
      },
      {
        id: "add-customer" as DrawerStep,
        label: "Add Customer",
        description: "Register a new customer in the system",
        icon: <UserPlus className="w-5 h-5" />,
        color: "border-indigo-500/30 bg-indigo-500/10 hover:bg-indigo-500/20",
      },
      {
        id: "add-partner" as DrawerStep,
        label: "Add Partner",
        description: "Add a new business partner",
        icon: <Handshake className="w-5 h-5" />,
        color: "border-pink-500/30 bg-pink-500/10 hover:bg-pink-500/20",
      },
      {
        id: "add-salesperson" as DrawerStep,
        label: "Add Sales Person",
        description: "Add a team member to handle sales",
        icon: <UserPlus className="w-5 h-5" />,
        color: "border-fuchsia-500/30 bg-fuchsia-500/10 hover:bg-fuchsia-500/20",
      },
    ],
  },
  {
    id: "ai-tools",
    label: "AI Tools",
    description: "AI-powered sales assistance",
    icon: <Sparkles className="w-5 h-5" />,
    color: "text-pink-400",
    activities: [
      {
        id: "analyze-lead" as DrawerStep,
        label: "Analyze Lead",
        description: "Use AI to analyze and score a potential lead",
        icon: <Sparkles className="w-5 h-5" />,
        color: "border-pink-500/30 bg-pink-500/10 hover:bg-pink-500/20",
      },
    ],
  },
];

/* =============================================================================
   OUTCOME OPTIONS
   ============================================================================= */

const phoneCallOutcomes = [
  { value: "connected_successful", label: "Connected - Successful" },
  { value: "connected_needs_followup", label: "Connected - Needs Follow-up" },
  { value: "voicemail", label: "Left Voicemail" },
  { value: "no_answer", label: "No Answer" },
  { value: "wrong_number", label: "Wrong Number" },
];

const meetingOutcomes = [
  { value: "very_positive", label: "Very Positive" },
  { value: "positive", label: "Positive" },
  { value: "neutral", label: "Neutral" },
  { value: "negative", label: "Negative" },
  { value: "pending_followup", label: "Pending Follow-up" },
];

const issueOutcomes = [
  { value: "resolved", label: "Resolved" },
  { value: "escalated", label: "Escalated" },
  { value: "investigating", label: "Investigating" },
  { value: "pending_followup", label: "Pending Follow-up" },
];

/* =============================================================================
   MAIN COMPONENT
   ============================================================================= */

interface RecordActivityDrawerProps {
  open: boolean;
  onClose: () => void;
  onActivityCreated?: () => void;
  preselectedCustomerId?: string;
  preselectedLeadId?: string;
}

export function RecordActivityDrawer({
  open,
  onClose,
  onActivityCreated,
  preselectedCustomerId,
  preselectedLeadId,
}: RecordActivityDrawerProps) {
  const { addToast } = useToast();
  const [step, setStep] = React.useState<DrawerStep>("menu");
  const [loading, setLoading] = React.useState(false);
  const [expandedCategory, setExpandedCategory] = React.useState<string | null>(null);

  // Data
  const [items, setItems] = React.useState<Item[]>([]);
  const [products, setProducts] = React.useState<Array<{ id: string; sku: string | null; name: string }>>([]);
  const [customers, setCustomers] = React.useState<Customer[]>([]);
  const [parties, setParties] = React.useState<Party[]>([]);
  const [salespersons, setSalespersons] = React.useState<Salesperson[]>([]);
  const [leads, setLeads] = React.useState<Lead[]>([]);

  // Activity form (generic for most activity types)
  const [activityForm, setActivityForm] = React.useState({
    activityType: "" as ActivityType | "",
    customerId: preselectedCustomerId || "",
    leadId: preselectedLeadId || "",
    personId: "",
    subject: "",
    notes: "",
    outcome: "",
    scheduledAt: "",
    completedAt: new Date().toISOString().slice(0, 16),
    durationMinutes: "",
    followUpDate: "",
    followUpNotes: "",
    priority: "medium",
    // For issue tracking
    issueDetails: "",
    // For deal won/lost
    dealValue: "",
    lostReason: "",
  });

  // Sale/Quote forms (kept from original)
  const [saleForm, setSaleForm] = React.useState({
    partyId: "",
    partyType: "customer" as "customer" | "partner",
    docDate: new Date().toISOString().split("T")[0],
    dueDate: "",
    salespersonId: "",
    notes: "",
  });

  const [quoteForm, setQuoteForm] = React.useState({
    partyId: "",
    partyType: "customer" as "customer" | "partner",
    docDate: new Date().toISOString().split("T")[0],
    expiryDate: "",
    salespersonId: "",
    notes: "",
  });

  const [lineItems, setLineItems] = React.useState<LineItem[]>([]);
  const [showAddItem, setShowAddItem] = React.useState(false);
  const [selectedItemId, setSelectedItemId] = React.useState("");
  const [itemQuantity, setItemQuantity] = React.useState("1");
  const [itemPrice, setItemPrice] = React.useState("");
  const [itemDiscount, setItemDiscount] = React.useState("0");

  // Customer form
  const [customerForm, setCustomerForm] = React.useState({
    name: "",
    code: "",
    email: "",
    phone: "",
    address: "",
    notes: "",
  });

  // Salesperson form
  const [salespersonForm, setSalespersonForm] = React.useState({
    name: "",
    email: "",
    phone: "",
  });

  // Partner form
  const [partnerForm, setPartnerForm] = React.useState({
    name: "",
    code: "",
    email: "",
    phone: "",
    address: "",
    notes: "",
  });

  // Lead analysis form
  const [leadForm, setLeadForm] = React.useState({
    name: "",
    email: "",
    phone: "",
    company: "",
    industry: "",
    companySize: "",
    budget: "",
    timeline: "",
    requirements: "",
    painPoints: "",
    currentSolution: "",
    decisionMakers: "",
    source: "",
    notes: "",
  });

  // AI Analysis result type
  interface AIAnalysisResult {
    summary: string;
    leadScore: number;
    leadScoreRationale: string;
    winProbability: number;
    recommendedApproach: string;
    keyInsights: string[];
    potentialChallenges: string[];
    suggestedNextSteps: string[];
    recommendedItems: Array<{
      itemId: string | null;
      name: string;
      description: string;
      type: "product" | "service" | "consumable";
      quantity: number;
      unitPrice: number;
      rationale: string;
    }>;
    estimatedDealValue: number;
    estimatedCloseDate: string;
    competitorRisks?: string[];
  }

  const [leadAnalysis, setLeadAnalysis] = React.useState<AIAnalysisResult | null>(null);
  const [analyzing, setAnalyzing] = React.useState(false);

  // Load data when drawer opens
  React.useEffect(() => {
    if (open) {
      Promise.all([
        apiGet<{ items: Item[] }>("/api/master/items?limit=200").catch(() => ({ items: [] })),
        apiGet<{ items: Array<{ id: string; sku: string | null; name: string }> }>("/api/master/products?limit=200").catch(() => ({ items: [] })),
        apiGet<{ items: Customer[] }>("/api/sales-customers/customers").catch(() => ({ items: [] })),
        apiGet<{ items: Party[] }>("/api/master/parties?type=other&limit=100").catch(() => ({ items: [] })),
        apiGet<{ items: Salesperson[] }>("/api/sales-customers/salespersons").catch(() => ({ items: [] })),
        apiGet<{ leads: Lead[] }>("/api/sales-customers/leads?limit=100").catch(() => ({ leads: [] })),
      ]).then(([itemsRes, productsRes, customersRes, partiesRes, salespersonsRes, leadsRes]) => {
        setItems(itemsRes.items || []);
        setProducts(productsRes.items || []);
        setCustomers(customersRes.items || []);
        setParties(partiesRes.items || []);
        setSalespersons(salespersonsRes.items || []);
        setLeads(leadsRes.leads || []);
      });
    }
  }, [open]);

  // Update preselected values
  React.useEffect(() => {
    if (preselectedCustomerId) {
      setActivityForm(prev => ({ ...prev, customerId: preselectedCustomerId }));
    }
    if (preselectedLeadId) {
      setActivityForm(prev => ({ ...prev, leadId: preselectedLeadId }));
    }
  }, [preselectedCustomerId, preselectedLeadId]);

  const handleClose = () => {
    setStep("menu");
    setExpandedCategory(null);
    setLineItems([]);
    setShowAddItem(false);
    resetForms();
    onClose();
  };

  const resetForms = () => {
    setActivityForm({
      activityType: "",
      customerId: preselectedCustomerId || "",
      leadId: preselectedLeadId || "",
      personId: "",
      subject: "",
      notes: "",
      outcome: "",
      scheduledAt: "",
      completedAt: new Date().toISOString().slice(0, 16),
      durationMinutes: "",
      followUpDate: "",
      followUpNotes: "",
      priority: "medium",
      issueDetails: "",
      dealValue: "",
      lostReason: "",
    });
    setSaleForm({
      partyId: "",
      partyType: "customer",
      docDate: new Date().toISOString().split("T")[0],
      dueDate: "",
      salespersonId: "",
      notes: "",
    });
    setQuoteForm({
      partyId: "",
      partyType: "customer",
      docDate: new Date().toISOString().split("T")[0],
      expiryDate: "",
      salespersonId: "",
      notes: "",
    });
    setLeadAnalysis(null);
  };

  const handleBack = () => {
    if (step !== "menu") {
      setStep("menu");
      setLineItems([]);
      setShowAddItem(false);
      setLeadAnalysis(null);
    }
  };

  // Calculate totals for line items
  const calculateTotals = () => {
    const subtotal = lineItems.reduce((sum, item) => sum + item.lineTotal, 0);
    const totalCost = lineItems.reduce((sum, item) => sum + item.cost * item.quantity, 0);
    const tax = subtotal * 0.1;
    const total = subtotal + tax;
    return { subtotal, totalCost, tax, total };
  };

  // Add line item
  const handleAddLineItem = () => {
    if (!selectedItemId || !itemQuantity) return;

    const item = items.find((i) => i.id === selectedItemId);
    if (!item) return;

    const quantity = parseFloat(itemQuantity);
    const unitPrice = parseFloat(itemPrice) || parseFloat(item.defaultSalesPrice || "0");
    const cost = parseFloat(item.defaultPurchaseCost || "0");
    const discountPercent = parseFloat(itemDiscount) || 0;
    const discountAmount = (unitPrice * quantity * discountPercent) / 100;
    const lineSubtotal = unitPrice * quantity - discountAmount;
    const taxAmount = lineSubtotal * 0.1;
    const lineTotal = lineSubtotal + taxAmount;

    const newItem: LineItem = {
      id: `temp-${Date.now()}`,
      itemId: item.id,
      itemName: item.name,
      itemType: item.type,
      description: item.name,
      quantity,
      unitPrice,
      cost,
      discountPercent,
      taxAmount,
      lineTotal,
    };

    setLineItems([...lineItems, newItem]);
    setShowAddItem(false);
    setSelectedItemId("");
    setItemQuantity("1");
    setItemPrice("");
    setItemDiscount("0");
  };

  const handleRemoveLineItem = (id: string) => {
    setLineItems(lineItems.filter((item) => item.id !== id));
  };

  /* =============================================================================
     ACTIVITY SUBMISSION
     ============================================================================= */

  const handleSubmitActivity = async (activityType: ActivityType) => {
    if (!activityForm.customerId && !activityForm.leadId) {
      addToast("error", "Please select a customer or lead");
      return;
    }

    if (!activityForm.subject) {
      addToast("error", "Please enter a subject");
      return;
    }

    setLoading(true);
    try {
      await apiPost("/api/sales-customers/activities", {
        activityType,
        customerId: activityForm.customerId || null,
        leadId: activityForm.leadId || null,
        personId: activityForm.personId || null,
        subject: activityForm.subject,
        notes: activityForm.notes || null,
        outcome: activityForm.outcome || null,
        scheduledAt: activityForm.scheduledAt || null,
        completedAt: activityForm.completedAt || null,
        durationMinutes: activityForm.durationMinutes ? parseInt(activityForm.durationMinutes) : null,
        followUpDate: activityForm.followUpDate || null,
        followUpNotes: activityForm.followUpNotes || null,
        priority: activityForm.priority,
        metadata: {
          issueDetails: activityForm.issueDetails || null,
          dealValue: activityForm.dealValue || null,
          lostReason: activityForm.lostReason || null,
        },
      });

      addToast("success", "Activity logged successfully!");
      handleClose();
      onActivityCreated?.();
    } catch (error) {
      addToast("error", error instanceof Error ? error.message : "Failed to log activity");
    } finally {
      setLoading(false);
    }
  };

  /* =============================================================================
     DOCUMENT HANDLERS (Invoice/Quote - kept from original)
     ============================================================================= */

  const handleCreateSale = async () => {
    if (!saleForm.partyId) {
      addToast("error", "Please select a customer or partner");
      return;
    }
    if (lineItems.length === 0) {
      addToast("error", "Please add at least one item");
      return;
    }

    setLoading(true);
    try {
      const { subtotal, tax, total } = calculateTotals();
      const docNumber = `INV-${Date.now().toString(36).toUpperCase()}`;

      const doc = await apiPost<{ id: string }>("/api/sales/docs", {
        docType: "invoice",
        docNumber,
        partyId: saleForm.partyId,
        docDate: saleForm.docDate,
        dueDate: saleForm.dueDate || null,
        subtotal: subtotal.toFixed(2),
        discountAmount: "0",
        taxAmount: tax.toFixed(2),
        totalAmount: total.toFixed(2),
        notes: saleForm.notes || null,
        metadata: {
          salespersonId: saleForm.salespersonId || null,
          partyType: saleForm.partyType,
        },
      });

      for (const lineItem of lineItems) {
        const item = items.find((i) => i.id === lineItem.itemId);
        let productId: string | null = null;
        if (item) {
          const productBySku = item.sku ? products.find((p) => p.sku === item.sku) : null;
          const productByName = products.find((p) => p.name === item.name);
          productId = productBySku?.id || productByName?.id || null;
        }

        await apiPost(`/api/sales/docs/${doc.id}/lines`, {
          productId: productId || undefined,
          description: lineItem.description,
          quantity: lineItem.quantity.toString(),
          unitPrice: lineItem.unitPrice.toFixed(2),
          discountPercent: lineItem.discountPercent.toString(),
          discountAmount: ((lineItem.unitPrice * lineItem.quantity * lineItem.discountPercent) / 100).toFixed(2),
          taxAmount: lineItem.taxAmount.toFixed(2),
          lineTotal: lineItem.lineTotal.toFixed(2),
          metadata: {
            cost: lineItem.cost,
            itemId: lineItem.itemId,
          },
        });
      }

      addToast("success", "Sale created successfully!");
      handleClose();
      onActivityCreated?.();
    } catch (error) {
      addToast("error", error instanceof Error ? error.message : "Failed to create sale");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateQuote = async () => {
    if (!quoteForm.partyId) {
      addToast("error", "Please select a customer or partner");
      return;
    }
    if (lineItems.length === 0) {
      addToast("error", "Please add at least one item");
      return;
    }

    setLoading(true);
    try {
      const { subtotal, tax, total } = calculateTotals();
      const docNumber = `QTE-${Date.now().toString(36).toUpperCase()}`;

      const doc = await apiPost<{ id: string }>("/api/sales/docs", {
        docType: "quote",
        docNumber,
        partyId: quoteForm.partyId,
        docDate: quoteForm.docDate,
        dueDate: quoteForm.expiryDate || null,
        subtotal: subtotal.toFixed(2),
        discountAmount: "0",
        taxAmount: tax.toFixed(2),
        totalAmount: total.toFixed(2),
        notes: quoteForm.notes || null,
        metadata: {
          salespersonId: quoteForm.salespersonId || null,
          partyType: quoteForm.partyType,
        },
      });

      for (const lineItem of lineItems) {
        const item = items.find((i) => i.id === lineItem.itemId);
        let productId: string | null = null;
        if (item) {
          const productBySku = item.sku ? products.find((p) => p.sku === item.sku) : null;
          const productByName = products.find((p) => p.name === item.name);
          productId = productBySku?.id || productByName?.id || null;
        }

        await apiPost(`/api/sales/docs/${doc.id}/lines`, {
          productId: productId || undefined,
          description: lineItem.description,
          quantity: lineItem.quantity.toString(),
          unitPrice: lineItem.unitPrice.toFixed(2),
          discountPercent: lineItem.discountPercent.toString(),
          discountAmount: ((lineItem.unitPrice * lineItem.quantity * lineItem.discountPercent) / 100).toFixed(2),
          taxAmount: lineItem.taxAmount.toFixed(2),
          lineTotal: lineItem.lineTotal.toFixed(2),
          metadata: {
            cost: lineItem.cost,
            itemId: lineItem.itemId,
          },
        });
      }

      // Log the quote_sent activity
      await apiPost("/api/sales-customers/activities", {
        activityType: "quote_sent",
        customerId: quoteForm.partyId,
        subject: `Quote ${docNumber} sent`,
        notes: quoteForm.notes || null,
        completedAt: new Date().toISOString(),
        metadata: { docId: doc.id, docNumber },
      }).catch(() => {}); // Don't fail if activity logging fails

      addToast("success", "Quote created successfully!");
      handleClose();
      onActivityCreated?.();
    } catch (error) {
      addToast("error", error instanceof Error ? error.message : "Failed to create quote");
    } finally {
      setLoading(false);
    }
  };

  /* =============================================================================
     ENTITY HANDLERS (Customer, Salesperson, Partner)
     ============================================================================= */

  const handleAddCustomer = async () => {
    if (!customerForm.name) {
      addToast("error", "Customer name is required");
      return;
    }

    setLoading(true);
    try {
      await apiPost("/api/sales-customers/customers", {
        name: customerForm.name,
        code: customerForm.code || undefined,
        email: customerForm.email || undefined,
        phone: customerForm.phone || undefined,
        address: customerForm.address || undefined,
        notes: customerForm.notes || undefined,
      });

      addToast("success", "Customer added successfully!");
      handleClose();
      onActivityCreated?.();
    } catch (error) {
      addToast("error", error instanceof Error ? error.message : "Failed to add customer");
    } finally {
      setLoading(false);
    }
  };

  const handleAddSalesperson = async () => {
    if (!salespersonForm.name) {
      addToast("error", "Salesperson name is required");
      return;
    }

    setLoading(true);
    try {
      await apiPost("/api/sales-customers/salespersons", {
        name: salespersonForm.name,
        email: salespersonForm.email || undefined,
        phone: salespersonForm.phone || undefined,
      });

      addToast("success", "Salesperson added successfully!");
      handleClose();
      onActivityCreated?.();
    } catch (error) {
      addToast("error", error instanceof Error ? error.message : "Failed to add salesperson");
    } finally {
      setLoading(false);
    }
  };

  const handleAddPartner = async () => {
    if (!partnerForm.name) {
      addToast("error", "Partner name is required");
      return;
    }

    setLoading(true);
    try {
      const code = partnerForm.code || `PRT-${Date.now().toString(36).toUpperCase()}`;
      const profiles = [];
      if (partnerForm.email || partnerForm.phone) {
        profiles.push({
          profileType: "contact",
          data: { email: partnerForm.email || null, phone: partnerForm.phone || null },
        });
      }
      if (partnerForm.address) {
        profiles.push({ profileType: "address", data: { address: partnerForm.address } });
      }

      await apiPost("/api/master/parties", {
        type: "other",
        code,
        name: partnerForm.name,
        notes: partnerForm.notes || undefined,
        profiles: profiles.length > 0 ? profiles : undefined,
      });

      addToast("success", "Partner added successfully!");
      handleClose();
      onActivityCreated?.();
    } catch (error) {
      addToast("error", error instanceof Error ? error.message : "Failed to add partner");
    } finally {
      setLoading(false);
    }
  };

  /* =============================================================================
     LEAD ANALYSIS
     ============================================================================= */

  const handleAnalyzeLead = async () => {
    if (!leadForm.name && !leadForm.email && !leadForm.company) {
      addToast("error", "Please provide at least name, email, or company");
      return;
    }

    setAnalyzing(true);
    try {
      const response = await apiPost<{ analysis: AIAnalysisResult }>("/api/sales-customers/analyze-sale", {
        name: leadForm.name,
        email: leadForm.email,
        phone: leadForm.phone,
        company: leadForm.company,
        industry: leadForm.industry,
        companySize: leadForm.companySize,
        budget: leadForm.budget,
        timeline: leadForm.timeline,
        requirements: leadForm.requirements,
        painPoints: leadForm.painPoints,
        currentSolution: leadForm.currentSolution,
        decisionMakers: leadForm.decisionMakers,
        source: leadForm.source,
        notes: leadForm.notes,
      });

      setLeadAnalysis(response.analysis);
    } catch (error) {
      // Create a fallback analysis if API fails
      const budget = parseFloat(leadForm.budget?.replace(/[^0-9.]/g, "") || "0");
      const fallbackAnalysis: AIAnalysisResult = {
        summary: `Opportunity with ${leadForm.company || leadForm.name || "potential customer"}. ${leadForm.requirements ? "Requirements identified." : "Further discovery needed."}`,
        leadScore: leadForm.company ? 60 : 40,
        leadScoreRationale: "Score based on available information",
        winProbability: 50,
        recommendedApproach: "Schedule a discovery call to understand specific needs.",
        keyInsights: [
          leadForm.requirements ? "Customer has stated requirements" : "Requirements need clarification",
          budget > 0 ? `Budget: ${leadForm.budget}` : "Budget not confirmed",
        ],
        potentialChallenges: ["Need more information to provide accurate analysis"],
        suggestedNextSteps: ["Schedule discovery call", "Prepare demo based on requirements"],
        recommendedItems: [
          {
            itemId: null,
            name: "Consultation Services",
            description: "Initial consultation to understand requirements",
            type: "service",
            quantity: 1,
            unitPrice: budget > 0 ? Math.round(budget * 0.1) : 500,
            rationale: "Starting point to scope the project",
          },
        ],
        estimatedDealValue: budget > 0 ? budget : 5000,
        estimatedCloseDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      };
      setLeadAnalysis(fallbackAnalysis);
      addToast("warning", "Using simplified analysis. AI service may be unavailable.");
    } finally {
      setAnalyzing(false);
    }
  };

  const handleConvertLead = async (type: "quote" | "sale") => {
    let customerId = "";
    try {
      const customer = await apiPost<{ id: string }>("/api/sales-customers/customers", {
        name: leadForm.name || leadForm.company || "Lead Customer",
        email: leadForm.email || undefined,
        phone: leadForm.phone || undefined,
        notes: `Converted from lead. Industry: ${leadForm.industry || "N/A"}. ${leadForm.notes || ""}`,
      });
      customerId = customer.id;
    } catch {
      addToast("error", "Failed to create customer from lead");
      return;
    }

    // Convert AI-recommended items to line items for the quote/sale
    if (leadAnalysis && leadAnalysis.recommendedItems.length > 0) {
      const newLineItems: LineItem[] = leadAnalysis.recommendedItems.map((recItem, index) => ({
        id: `ai-${Date.now()}-${index}`,
        itemId: recItem.itemId || `temp-${index}`,
        itemName: recItem.name,
        itemType: recItem.type,
        description: recItem.description,
        quantity: recItem.quantity,
        unitPrice: recItem.unitPrice,
        cost: 0, // Will be filled from catalog if item exists
        discountPercent: 0,
        taxAmount: recItem.quantity * recItem.unitPrice * 0.1,
        lineTotal: recItem.quantity * recItem.unitPrice * 1.1, // Including 10% tax
      }));
      setLineItems(newLineItems);
    }

    if (type === "quote") {
      // Set expiry date 30 days from now
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + 30);
      setQuoteForm({
        ...quoteForm,
        partyId: customerId,
        partyType: "customer",
        expiryDate: expiryDate.toISOString().split("T")[0],
        notes: leadAnalysis ? `AI Analysis Summary: ${leadAnalysis.summary}\n\nRecommended Approach: ${leadAnalysis.recommendedApproach}` : "",
      });
      setStep("create-quote");
      setLeadAnalysis(null);
    } else {
      setSaleForm({
        ...saleForm,
        partyId: customerId,
        partyType: "customer",
        notes: leadAnalysis ? `Converted from AI-analyzed lead. ${leadAnalysis.summary}` : "",
      });
      setStep("make-sale");
      setLeadAnalysis(null);
    }
  };

  /* =============================================================================
     RENDER HELPERS
     ============================================================================= */

  const getTitle = () => {
    const titles: Record<DrawerStep, string> = {
      menu: "Record Activity",
      "log-phone-call": "Log Phone Call",
      "log-email-sent": "Log Email Sent",
      "log-email-received": "Log Email Received",
      "log-meeting": "Log Meeting",
      "log-site-visit": "Log Site Visit",
      "send-quote": "Send Quote",
      "follow-up-quote": "Follow Up on Quote",
      "record-order": "Record Order",
      "confirm-order": "Confirm Order",
      "schedule-delivery": "Schedule Delivery",
      "complete-delivery": "Complete Delivery",
      "send-payment-reminder": "Send Payment Reminder",
      "log-customer-issue": "Log Customer Issue",
      "record-deal-won": "Record Deal Won",
      "record-deal-lost": "Record Deal Lost",
      "add-note": "Add Note",
      "make-sale": "Make a Sale",
      "create-quote": "Create a Quote",
      "add-customer": "Add a Customer",
      "add-salesperson": "Add a Sales Person",
      "add-partner": "Add a Partner",
      "analyze-lead": "Analyze Lead",
    };
    return titles[step] || "Record Activity";
  };

  const totals = calculateTotals();

  /* =============================================================================
     RENDER: CUSTOMER/LEAD SELECTOR
     ============================================================================= */

  const renderCustomerLeadSelector = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <label className="block text-sm font-medium text-white/70 mb-1.5">Customer</label>
        <select
          value={activityForm.customerId}
          onChange={(e) => setActivityForm({ ...activityForm, customerId: e.target.value, leadId: "" })}
          className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-white/25"
        >
          <option value="" className="bg-zinc-900">Select customer...</option>
          {customers.map((c) => (
            <option key={c.id} value={c.id} className="bg-zinc-900">
              {c.name} ({c.code})
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-white/70 mb-1.5">Or Lead</label>
        <select
          value={activityForm.leadId}
          onChange={(e) => setActivityForm({ ...activityForm, leadId: e.target.value, customerId: "" })}
          className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-white/25"
        >
          <option value="" className="bg-zinc-900">Select lead...</option>
          {leads.map((l) => (
            <option key={l.id} value={l.id} className="bg-zinc-900">
              {l.name} ({l.status})
            </option>
          ))}
        </select>
      </div>
    </div>
  );

  /* =============================================================================
     RENDER: ACTIVITY FORM (Generic template for most activity types)
     ============================================================================= */

  const renderActivityForm = (activityType: ActivityType, showOutcome?: { options: { value: string; label: string }[]; label: string }) => (
    <div className="space-y-5">
      <button onClick={handleBack} className="flex items-center gap-2 text-sm text-white/60 hover:text-white transition-colors">
        <ArrowLeft className="w-4 h-4" />
        Back
      </button>

      {renderCustomerLeadSelector()}

      <GlassInput
        label="Subject *"
        placeholder="Brief description of the activity"
        value={activityForm.subject}
        onChange={(e) => setActivityForm({ ...activityForm, subject: e.target.value })}
      />

      {showOutcome && (
        <div>
          <label className="block text-sm font-medium text-white/70 mb-1.5">{showOutcome.label}</label>
          <select
            value={activityForm.outcome}
            onChange={(e) => setActivityForm({ ...activityForm, outcome: e.target.value })}
            className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-white/25"
          >
            <option value="" className="bg-zinc-900">Select outcome...</option>
            {showOutcome.options.map((opt) => (
              <option key={opt.value} value={opt.value} className="bg-zinc-900">
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-white/70 mb-1.5">Completed At</label>
          <input
            type="datetime-local"
            value={activityForm.completedAt}
            onChange={(e) => setActivityForm({ ...activityForm, completedAt: e.target.value })}
            className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-white/25"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-white/70 mb-1.5">Duration (minutes)</label>
          <input
            type="number"
            value={activityForm.durationMinutes}
            onChange={(e) => setActivityForm({ ...activityForm, durationMinutes: e.target.value })}
            placeholder="e.g., 30"
            className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-white/25"
          />
        </div>
      </div>

      <GlassTextarea
        label="Notes"
        placeholder="Details about the activity..."
        value={activityForm.notes}
        onChange={(e) => setActivityForm({ ...activityForm, notes: e.target.value })}
        rows={3}
      />

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-white/70 mb-1.5">Follow-up Date</label>
          <input
            type="date"
            value={activityForm.followUpDate}
            onChange={(e) => setActivityForm({ ...activityForm, followUpDate: e.target.value })}
            className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-white/25"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-white/70 mb-1.5">Priority</label>
          <select
            value={activityForm.priority}
            onChange={(e) => setActivityForm({ ...activityForm, priority: e.target.value })}
            className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-white/25"
          >
            <option value="low" className="bg-zinc-900">Low</option>
            <option value="medium" className="bg-zinc-900">Medium</option>
            <option value="high" className="bg-zinc-900">High</option>
            <option value="urgent" className="bg-zinc-900">Urgent</option>
          </select>
        </div>
      </div>

      <div className="flex gap-3 pt-4">
        <GlassButton type="button" variant="ghost" onClick={handleClose} className="flex-1">
          Cancel
        </GlassButton>
        <GlassButton
          type="button"
          variant="primary"
          onClick={() => handleSubmitActivity(activityType)}
          disabled={loading}
          className="flex-1"
        >
          {loading ? <Spinner size="sm" /> : "Log Activity"}
        </GlassButton>
      </div>
    </div>
  );

  /* =============================================================================
     RENDER: ISSUE FORM
     ============================================================================= */

  const renderIssueForm = () => (
    <div className="space-y-5">
      <button onClick={handleBack} className="flex items-center gap-2 text-sm text-white/60 hover:text-white transition-colors">
        <ArrowLeft className="w-4 h-4" />
        Back
      </button>

      {renderCustomerLeadSelector()}

      <GlassInput
        label="Issue Subject *"
        placeholder="Brief description of the issue"
        value={activityForm.subject}
        onChange={(e) => setActivityForm({ ...activityForm, subject: e.target.value })}
      />

      <GlassTextarea
        label="Issue Details *"
        placeholder="Describe the issue in detail..."
        value={activityForm.issueDetails}
        onChange={(e) => setActivityForm({ ...activityForm, issueDetails: e.target.value })}
        rows={4}
      />

      <div>
        <label className="block text-sm font-medium text-white/70 mb-1.5">Status</label>
        <select
          value={activityForm.outcome}
          onChange={(e) => setActivityForm({ ...activityForm, outcome: e.target.value })}
          className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-white/25"
        >
          <option value="" className="bg-zinc-900">Select status...</option>
          {issueOutcomes.map((opt) => (
            <option key={opt.value} value={opt.value} className="bg-zinc-900">
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-white/70 mb-1.5">Priority</label>
          <select
            value={activityForm.priority}
            onChange={(e) => setActivityForm({ ...activityForm, priority: e.target.value })}
            className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-white/25"
          >
            <option value="low" className="bg-zinc-900">Low</option>
            <option value="medium" className="bg-zinc-900">Medium</option>
            <option value="high" className="bg-zinc-900">High</option>
            <option value="urgent" className="bg-zinc-900">Urgent</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-white/70 mb-1.5">Follow-up Date</label>
          <input
            type="date"
            value={activityForm.followUpDate}
            onChange={(e) => setActivityForm({ ...activityForm, followUpDate: e.target.value })}
            className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-white/25"
          />
        </div>
      </div>

      <GlassTextarea
        label="Notes"
        placeholder="Additional notes..."
        value={activityForm.notes}
        onChange={(e) => setActivityForm({ ...activityForm, notes: e.target.value })}
        rows={2}
      />

      <div className="flex gap-3 pt-4">
        <GlassButton type="button" variant="ghost" onClick={handleClose} className="flex-1">
          Cancel
        </GlassButton>
        <GlassButton
          type="button"
          variant="primary"
          onClick={() => handleSubmitActivity("customer_issue")}
          disabled={loading}
          className="flex-1"
        >
          {loading ? <Spinner size="sm" /> : "Log Issue"}
        </GlassButton>
      </div>
    </div>
  );

  /* =============================================================================
     RENDER: DEAL WON/LOST FORMS
     ============================================================================= */

  const renderDealWonForm = () => (
    <div className="space-y-5">
      <button onClick={handleBack} className="flex items-center gap-2 text-sm text-white/60 hover:text-white transition-colors">
        <ArrowLeft className="w-4 h-4" />
        Back
      </button>

      <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4 mb-2">
        <div className="flex items-center gap-3">
          <Trophy className="w-8 h-8 text-yellow-400" />
          <div>
            <h3 className="font-semibold text-white">Congratulations on the win!</h3>
            <p className="text-sm text-white/60">Record the details of this closed deal.</p>
          </div>
        </div>
      </div>

      {renderCustomerLeadSelector()}

      <GlassInput
        label="Deal Name *"
        placeholder="Name or description of the deal"
        value={activityForm.subject}
        onChange={(e) => setActivityForm({ ...activityForm, subject: e.target.value })}
      />

      <GlassInput
        label="Deal Value"
        type="number"
        placeholder="e.g., 10000"
        value={activityForm.dealValue}
        onChange={(e) => setActivityForm({ ...activityForm, dealValue: e.target.value })}
      />

      <GlassTextarea
        label="Notes"
        placeholder="Details about the deal, what made it successful..."
        value={activityForm.notes}
        onChange={(e) => setActivityForm({ ...activityForm, notes: e.target.value })}
        rows={3}
      />

      <div className="flex gap-3 pt-4">
        <GlassButton type="button" variant="ghost" onClick={handleClose} className="flex-1">
          Cancel
        </GlassButton>
        <GlassButton
          type="button"
          variant="primary"
          onClick={() => handleSubmitActivity("deal_won")}
          disabled={loading}
          className="flex-1"
        >
          {loading ? <Spinner size="sm" /> : "Record Win"}
        </GlassButton>
      </div>
    </div>
  );

  const renderDealLostForm = () => (
    <div className="space-y-5">
      <button onClick={handleBack} className="flex items-center gap-2 text-sm text-white/60 hover:text-white transition-colors">
        <ArrowLeft className="w-4 h-4" />
        Back
      </button>

      {renderCustomerLeadSelector()}

      <GlassInput
        label="Deal Name *"
        placeholder="Name or description of the deal"
        value={activityForm.subject}
        onChange={(e) => setActivityForm({ ...activityForm, subject: e.target.value })}
      />

      <GlassInput
        label="Potential Value"
        type="number"
        placeholder="e.g., 10000"
        value={activityForm.dealValue}
        onChange={(e) => setActivityForm({ ...activityForm, dealValue: e.target.value })}
      />

      <div>
        <label className="block text-sm font-medium text-white/70 mb-1.5">Reason for Loss *</label>
        <select
          value={activityForm.lostReason}
          onChange={(e) => setActivityForm({ ...activityForm, lostReason: e.target.value })}
          className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-white/25"
        >
          <option value="" className="bg-zinc-900">Select reason...</option>
          <option value="price" className="bg-zinc-900">Price too high</option>
          <option value="competitor" className="bg-zinc-900">Lost to competitor</option>
          <option value="timing" className="bg-zinc-900">Bad timing / not ready</option>
          <option value="budget" className="bg-zinc-900">No budget</option>
          <option value="features" className="bg-zinc-900">Missing features</option>
          <option value="relationship" className="bg-zinc-900">Relationship issue</option>
          <option value="no_response" className="bg-zinc-900">No response / went dark</option>
          <option value="other" className="bg-zinc-900">Other</option>
        </select>
      </div>

      <GlassTextarea
        label="Notes"
        placeholder="Additional details about why the deal was lost..."
        value={activityForm.notes}
        onChange={(e) => setActivityForm({ ...activityForm, notes: e.target.value })}
        rows={3}
      />

      <div className="flex gap-3 pt-4">
        <GlassButton type="button" variant="ghost" onClick={handleClose} className="flex-1">
          Cancel
        </GlassButton>
        <GlassButton
          type="button"
          variant="primary"
          onClick={() => handleSubmitActivity("deal_lost")}
          disabled={loading}
          className="flex-1"
        >
          {loading ? <Spinner size="sm" /> : "Record Loss"}
        </GlassButton>
      </div>
    </div>
  );

  /* =============================================================================
     RENDER: LINE ITEMS (for Sale/Quote)
     ============================================================================= */

  const renderSaleForm = () => (
    <div className="space-y-6">
      <button onClick={handleBack} className="flex items-center gap-2 text-sm text-white/60 hover:text-white transition-colors">
        <ArrowLeft className="w-4 h-4" />
        Back
      </button>

      {/* Party Selection */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-white/70 mb-1.5">Type</label>
          <select
            value={saleForm.partyType}
            onChange={(e) => setSaleForm({ ...saleForm, partyType: e.target.value as "customer" | "partner", partyId: "" })}
            className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-white/25"
          >
            <option value="customer" className="bg-zinc-900">Customer</option>
            <option value="partner" className="bg-zinc-900">Partner</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-white/70 mb-1.5">
            {saleForm.partyType === "customer" ? "Customer" : "Partner"} *
          </label>
          <select
            value={saleForm.partyId}
            onChange={(e) => setSaleForm({ ...saleForm, partyId: e.target.value })}
            className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-white/25"
          >
            <option value="" className="bg-zinc-900">Select...</option>
            {(saleForm.partyType === "customer" ? customers : parties).map((p) => (
              <option key={p.id} value={p.id} className="bg-zinc-900">
                {p.name} ({p.code})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Salesperson Assignment */}
      <div>
        <label className="block text-sm font-medium text-white/70 mb-1.5">Assign to Sales Person</label>
        <select
          value={saleForm.salespersonId}
          onChange={(e) => setSaleForm({ ...saleForm, salespersonId: e.target.value })}
          className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-white/25"
        >
          <option value="" className="bg-zinc-900">None</option>
          {salespersons.map((sp) => (
            <option key={sp.id} value={sp.id} className="bg-zinc-900">
              {sp.name}
            </option>
          ))}
        </select>
      </div>

      {/* Dates */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-white/70 mb-1.5">Date *</label>
          <input
            type="date"
            value={saleForm.docDate}
            onChange={(e) => setSaleForm({ ...saleForm, docDate: e.target.value })}
            className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-white/25"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-white/70 mb-1.5">Due Date</label>
          <input
            type="date"
            value={saleForm.dueDate}
            onChange={(e) => setSaleForm({ ...saleForm, dueDate: e.target.value })}
            className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-white/25"
          />
        </div>
      </div>

      {renderLineItemsSection()}

      {/* Notes */}
      <div>
        <label className="block text-sm font-medium text-white/70 mb-1.5">Notes</label>
        <textarea
          value={saleForm.notes}
          onChange={(e) => setSaleForm({ ...saleForm, notes: e.target.value })}
          className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/40 focus:outline-none focus:border-white/25"
          rows={3}
          placeholder="Additional notes..."
        />
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-4">
        <GlassButton type="button" variant="ghost" onClick={handleClose} className="flex-1">
          Cancel
        </GlassButton>
        <GlassButton
          type="button"
          variant="primary"
          onClick={handleCreateSale}
          disabled={loading || lineItems.length === 0}
          className="flex-1"
        >
          {loading ? <Spinner size="sm" /> : "Create Sale"}
        </GlassButton>
      </div>
    </div>
  );

  const renderQuoteForm = () => (
    <div className="space-y-6">
      <button onClick={handleBack} className="flex items-center gap-2 text-sm text-white/60 hover:text-white transition-colors">
        <ArrowLeft className="w-4 h-4" />
        Back
      </button>

      {/* Party Selection */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-white/70 mb-1.5">Type</label>
          <select
            value={quoteForm.partyType}
            onChange={(e) => setQuoteForm({ ...quoteForm, partyType: e.target.value as "customer" | "partner", partyId: "" })}
            className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-white/25"
          >
            <option value="customer" className="bg-zinc-900">Customer</option>
            <option value="partner" className="bg-zinc-900">Partner</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-white/70 mb-1.5">
            {quoteForm.partyType === "customer" ? "Customer" : "Partner"} *
          </label>
          <select
            value={quoteForm.partyId}
            onChange={(e) => setQuoteForm({ ...quoteForm, partyId: e.target.value })}
            className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-white/25"
          >
            <option value="" className="bg-zinc-900">Select...</option>
            {(quoteForm.partyType === "customer" ? customers : parties).map((p) => (
              <option key={p.id} value={p.id} className="bg-zinc-900">
                {p.name} ({p.code})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Salesperson Assignment */}
      <div>
        <label className="block text-sm font-medium text-white/70 mb-1.5">Assign to Sales Person</label>
        <select
          value={quoteForm.salespersonId}
          onChange={(e) => setQuoteForm({ ...quoteForm, salespersonId: e.target.value })}
          className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-white/25"
        >
          <option value="" className="bg-zinc-900">None</option>
          {salespersons.map((sp) => (
            <option key={sp.id} value={sp.id} className="bg-zinc-900">
              {sp.name}
            </option>
          ))}
        </select>
      </div>

      {/* Dates */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-white/70 mb-1.5">Date *</label>
          <input
            type="date"
            value={quoteForm.docDate}
            onChange={(e) => setQuoteForm({ ...quoteForm, docDate: e.target.value })}
            className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-white/25"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-white/70 mb-1.5">Expiry Date</label>
          <input
            type="date"
            value={quoteForm.expiryDate}
            onChange={(e) => setQuoteForm({ ...quoteForm, expiryDate: e.target.value })}
            className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-white/25"
          />
        </div>
      </div>

      {renderLineItemsSection()}

      {/* Notes */}
      <div>
        <label className="block text-sm font-medium text-white/70 mb-1.5">Notes</label>
        <textarea
          value={quoteForm.notes}
          onChange={(e) => setQuoteForm({ ...quoteForm, notes: e.target.value })}
          className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/40 focus:outline-none focus:border-white/25"
          rows={3}
          placeholder="Additional notes..."
        />
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-4">
        <GlassButton type="button" variant="ghost" onClick={handleClose} className="flex-1">
          Cancel
        </GlassButton>
        <GlassButton
          type="button"
          variant="primary"
          onClick={handleCreateQuote}
          disabled={loading || lineItems.length === 0}
          className="flex-1"
        >
          {loading ? <Spinner size="sm" /> : "Create Quote"}
        </GlassButton>
      </div>
    </div>
  );

  const renderLineItemsSection = () => (
    <div>
      <div className="flex items-center justify-between mb-3">
        <label className="block text-sm font-medium text-white/70">Items</label>
        <GlassButton type="button" variant="ghost" onClick={() => setShowAddItem(true)} className="text-sm">
          + Add Item
        </GlassButton>
      </div>

      {showAddItem && (
        <GlassCard className="mb-4 p-4">
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-white/70 mb-1.5">Item</label>
              <select
                value={selectedItemId}
                onChange={(e) => {
                  setSelectedItemId(e.target.value);
                  const item = items.find((i) => i.id === e.target.value);
                  if (item) {
                    setItemPrice(item.defaultSalesPrice || "");
                  }
                }}
                className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-white/25"
              >
                <option value="" className="bg-zinc-900">Select item...</option>
                {items.map((item) => (
                  <option key={item.id} value={item.id} className="bg-zinc-900">
                    {item.name} ({item.type}) - {formatCurrency(parseFloat(item.defaultSalesPrice || "0"))}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-sm font-medium text-white/70 mb-1.5">Quantity</label>
                <input
                  type="number"
                  value={itemQuantity}
                  onChange={(e) => setItemQuantity(e.target.value)}
                  className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-white/25"
                  min="0.01"
                  step="0.01"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-white/70 mb-1.5">Unit Price</label>
                <input
                  type="number"
                  value={itemPrice}
                  onChange={(e) => setItemPrice(e.target.value)}
                  className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-white/25"
                  min="0"
                  step="0.01"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-white/70 mb-1.5">Discount %</label>
                <input
                  type="number"
                  value={itemDiscount}
                  onChange={(e) => setItemDiscount(e.target.value)}
                  className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-white/25"
                  min="0"
                  max="100"
                  step="0.01"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <GlassButton type="button" variant="primary" onClick={handleAddLineItem} className="flex-1">
                Add
              </GlassButton>
              <GlassButton
                type="button"
                variant="ghost"
                onClick={() => {
                  setShowAddItem(false);
                  setSelectedItemId("");
                  setItemQuantity("1");
                  setItemPrice("");
                  setItemDiscount("0");
                }}
                className="flex-1"
              >
                Cancel
              </GlassButton>
            </div>
          </div>
        </GlassCard>
      )}

      {lineItems.length > 0 && (
        <div className="space-y-2 mb-4">
          {lineItems.map((item) => (
            <GlassCard key={item.id} className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="font-medium text-white">{item.itemName}</div>
                  <div className="text-sm text-white/60">
                    {item.quantity} × {formatCurrency(item.unitPrice)}
                    {item.discountPercent > 0 && ` (${item.discountPercent}% off)`}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-medium text-white">{formatCurrency(item.lineTotal)}</div>
                  <button
                    onClick={() => handleRemoveLineItem(item.id)}
                    className="text-xs text-red-400 hover:text-red-300 mt-1"
                  >
                    Remove
                  </button>
                </div>
              </div>
            </GlassCard>
          ))}
        </div>
      )}

      {/* Totals */}
      {lineItems.length > 0 && (
        <GlassCard className="p-4 bg-white/5">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-white/60">Subtotal:</span>
              <span className="text-white">{formatCurrency(totals.subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-white/60">Tax (10%):</span>
              <span className="text-white">{formatCurrency(totals.tax)}</span>
            </div>
            <div className="flex justify-between text-sm pt-2 border-t border-white/10">
              <span className="text-white font-medium">Total:</span>
              <span className="text-white font-medium text-lg">{formatCurrency(totals.total)}</span>
            </div>
          </div>
        </GlassCard>
      )}
    </div>
  );

  /* =============================================================================
     RENDER: ENTITY FORMS (Customer, Salesperson, Partner)
     ============================================================================= */

  const renderCustomerForm = () => (
    <div className="space-y-5">
      <button onClick={handleBack} className="flex items-center gap-2 text-sm text-white/60 hover:text-white transition-colors">
        <ArrowLeft className="w-4 h-4" />
        Back
      </button>

      <GlassInput
        label="Customer Name *"
        placeholder="e.g., Acme Corporation"
        value={customerForm.name}
        onChange={(e) => setCustomerForm({ ...customerForm, name: e.target.value })}
      />

      <GlassInput
        label="Customer Code"
        placeholder="Auto-generated if empty"
        value={customerForm.code}
        onChange={(e) => setCustomerForm({ ...customerForm, code: e.target.value })}
      />

      <GlassInput
        label="Email"
        type="email"
        placeholder="customer@example.com"
        value={customerForm.email}
        onChange={(e) => setCustomerForm({ ...customerForm, email: e.target.value })}
      />

      <GlassInput
        label="Phone"
        placeholder="+1 (555) 123-4567"
        value={customerForm.phone}
        onChange={(e) => setCustomerForm({ ...customerForm, phone: e.target.value })}
      />

      <GlassTextarea
        label="Address"
        placeholder="Street address, city, state, zip"
        value={customerForm.address}
        onChange={(e) => setCustomerForm({ ...customerForm, address: e.target.value })}
        rows={3}
      />

      <GlassTextarea
        label="Notes"
        placeholder="Additional information..."
        value={customerForm.notes}
        onChange={(e) => setCustomerForm({ ...customerForm, notes: e.target.value })}
        rows={2}
      />

      <div className="flex gap-3 pt-4">
        <GlassButton type="button" variant="ghost" onClick={handleClose} className="flex-1">
          Cancel
        </GlassButton>
        <GlassButton type="button" variant="primary" onClick={handleAddCustomer} disabled={loading} className="flex-1">
          {loading ? <Spinner size="sm" /> : "Add Customer"}
        </GlassButton>
      </div>
    </div>
  );

  const renderSalespersonForm = () => (
    <div className="space-y-5">
      <button onClick={handleBack} className="flex items-center gap-2 text-sm text-white/60 hover:text-white transition-colors">
        <ArrowLeft className="w-4 h-4" />
        Back
      </button>

      <GlassInput
        label="Sales Person Name *"
        placeholder="e.g., John Smith"
        value={salespersonForm.name}
        onChange={(e) => setSalespersonForm({ ...salespersonForm, name: e.target.value })}
      />

      <GlassInput
        label="Email"
        type="email"
        placeholder="john@example.com"
        value={salespersonForm.email}
        onChange={(e) => setSalespersonForm({ ...salespersonForm, email: e.target.value })}
      />

      <GlassInput
        label="Phone"
        placeholder="+1 (555) 123-4567"
        value={salespersonForm.phone}
        onChange={(e) => setSalespersonForm({ ...salespersonForm, phone: e.target.value })}
      />

      <div className="flex gap-3 pt-4">
        <GlassButton type="button" variant="ghost" onClick={handleClose} className="flex-1">
          Cancel
        </GlassButton>
        <GlassButton type="button" variant="primary" onClick={handleAddSalesperson} disabled={loading} className="flex-1">
          {loading ? <Spinner size="sm" /> : "Add Sales Person"}
        </GlassButton>
      </div>
    </div>
  );

  const renderPartnerForm = () => (
    <div className="space-y-5">
      <button onClick={handleBack} className="flex items-center gap-2 text-sm text-white/60 hover:text-white transition-colors">
        <ArrowLeft className="w-4 h-4" />
        Back
      </button>

      <GlassInput
        label="Partner Name *"
        placeholder="e.g., Partner Corp"
        value={partnerForm.name}
        onChange={(e) => setPartnerForm({ ...partnerForm, name: e.target.value })}
      />

      <GlassInput
        label="Partner Code"
        placeholder="Auto-generated if empty"
        value={partnerForm.code}
        onChange={(e) => setPartnerForm({ ...partnerForm, code: e.target.value })}
      />

      <GlassInput
        label="Email"
        type="email"
        placeholder="partner@example.com"
        value={partnerForm.email}
        onChange={(e) => setPartnerForm({ ...partnerForm, email: e.target.value })}
      />

      <GlassInput
        label="Phone"
        placeholder="+1 (555) 123-4567"
        value={partnerForm.phone}
        onChange={(e) => setPartnerForm({ ...partnerForm, phone: e.target.value })}
      />

      <GlassTextarea
        label="Address"
        placeholder="Street address, city, state, zip"
        value={partnerForm.address}
        onChange={(e) => setPartnerForm({ ...partnerForm, address: e.target.value })}
        rows={3}
      />

      <GlassTextarea
        label="Notes"
        placeholder="Additional information..."
        value={partnerForm.notes}
        onChange={(e) => setPartnerForm({ ...partnerForm, notes: e.target.value })}
        rows={2}
      />

      <div className="flex gap-3 pt-4">
        <GlassButton type="button" variant="ghost" onClick={handleClose} className="flex-1">
          Cancel
        </GlassButton>
        <GlassButton type="button" variant="primary" onClick={handleAddPartner} disabled={loading} className="flex-1">
          {loading ? <Spinner size="sm" /> : "Add Partner"}
        </GlassButton>
      </div>
    </div>
  );

  /* =============================================================================
     RENDER: LEAD ANALYSIS
     ============================================================================= */

  const getScoreColor = (score: number) => {
    if (score >= 70) return "text-green-400 bg-green-500/20 border-green-500/30";
    if (score >= 50) return "text-yellow-400 bg-yellow-500/20 border-yellow-500/30";
    return "text-red-400 bg-red-500/20 border-red-500/30";
  };

  const renderLeadAnalysisForm = () => (
    <div className="space-y-5">
      <button onClick={handleBack} className="flex items-center gap-2 text-sm text-white/60 hover:text-white transition-colors">
        <ArrowLeft className="w-4 h-4" />
        Back
      </button>

      {!leadAnalysis ? (
        <>
          <div className="bg-gradient-to-r from-purple-500/10 to-blue-500/10 border border-purple-500/30 rounded-xl p-4 mb-4">
            <div className="flex items-center gap-3">
              <Sparkles className="w-6 h-6 text-purple-400" />
              <div>
                <h3 className="font-medium text-white">AI Sale Analysis</h3>
                <p className="text-sm text-white/60">
                  Enter opportunity details and our AI will analyze the lead, score it, and recommend products for a quote.
                </p>
              </div>
            </div>
          </div>

          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4">
            <GlassInput
              label="Contact Name"
              placeholder="John Smith"
              value={leadForm.name}
              onChange={(e) => setLeadForm({ ...leadForm, name: e.target.value })}
            />
            <GlassInput
              label="Company *"
              placeholder="Acme Corporation"
              value={leadForm.company}
              onChange={(e) => setLeadForm({ ...leadForm, company: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <GlassInput
              label="Email"
              type="email"
              placeholder="john@acme.com"
              value={leadForm.email}
              onChange={(e) => setLeadForm({ ...leadForm, email: e.target.value })}
            />
            <GlassInput
              label="Phone"
              placeholder="+1 (555) 123-4567"
              value={leadForm.phone}
              onChange={(e) => setLeadForm({ ...leadForm, phone: e.target.value })}
            />
          </div>

          {/* Business Context */}
          <div className="grid grid-cols-2 gap-4">
            <GlassInput
              label="Industry"
              placeholder="e.g., Technology, Manufacturing"
              value={leadForm.industry}
              onChange={(e) => setLeadForm({ ...leadForm, industry: e.target.value })}
            />
            <GlassInput
              label="Company Size"
              placeholder="e.g., 50-200 employees"
              value={leadForm.companySize}
              onChange={(e) => setLeadForm({ ...leadForm, companySize: e.target.value })}
            />
          </div>

          {/* Opportunity Details */}
          <div className="grid grid-cols-2 gap-4">
            <GlassInput
              label="Budget *"
              placeholder="e.g., $25,000"
              value={leadForm.budget}
              onChange={(e) => setLeadForm({ ...leadForm, budget: e.target.value })}
            />
            <GlassInput
              label="Timeline"
              placeholder="e.g., Q2 2024, Within 3 months"
              value={leadForm.timeline}
              onChange={(e) => setLeadForm({ ...leadForm, timeline: e.target.value })}
            />
          </div>

          <GlassTextarea
            label="Requirements *"
            placeholder="What specific products/services are they looking for? What problems are they trying to solve?"
            value={leadForm.requirements}
            onChange={(e) => setLeadForm({ ...leadForm, requirements: e.target.value })}
            rows={3}
          />

          <GlassTextarea
            label="Pain Points"
            placeholder="What challenges or frustrations do they have with their current situation?"
            value={leadForm.painPoints}
            onChange={(e) => setLeadForm({ ...leadForm, painPoints: e.target.value })}
            rows={2}
          />

          <div className="grid grid-cols-2 gap-4">
            <GlassInput
              label="Current Solution"
              placeholder="What are they using now?"
              value={leadForm.currentSolution}
              onChange={(e) => setLeadForm({ ...leadForm, currentSolution: e.target.value })}
            />
            <GlassInput
              label="Decision Makers"
              placeholder="Who else is involved?"
              value={leadForm.decisionMakers}
              onChange={(e) => setLeadForm({ ...leadForm, decisionMakers: e.target.value })}
            />
          </div>

          <GlassInput
            label="Lead Source"
            placeholder="e.g., Website, Referral, Trade Show"
            value={leadForm.source}
            onChange={(e) => setLeadForm({ ...leadForm, source: e.target.value })}
          />

          <GlassTextarea
            label="Additional Notes"
            placeholder="Any other relevant information..."
            value={leadForm.notes}
            onChange={(e) => setLeadForm({ ...leadForm, notes: e.target.value })}
            rows={2}
          />

          <div className="flex gap-3 pt-4">
            <GlassButton type="button" variant="ghost" onClick={handleClose} className="flex-1">
              Cancel
            </GlassButton>
            <GlassButton type="button" variant="primary" onClick={handleAnalyzeLead} disabled={analyzing} className="flex-1 gap-2">
              {analyzing ? (
                <>
                  <Spinner size="sm" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Analyze with AI
                </>
              )}
            </GlassButton>
          </div>
        </>
      ) : (
        <>
          {/* AI Analysis Results */}
          <div className="space-y-4">
            {/* Summary Card */}
            <div className="bg-gradient-to-r from-purple-500/10 to-blue-500/10 border border-purple-500/30 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-purple-400 mt-0.5" />
                <div>
                  <h3 className="font-medium text-white mb-1">AI Analysis Summary</h3>
                  <p className="text-sm text-white/80">{leadAnalysis.summary}</p>
                </div>
              </div>
            </div>

            {/* Scores */}
            <div className="grid grid-cols-2 gap-4">
              <div className={`rounded-xl border p-4 ${getScoreColor(leadAnalysis.leadScore)}`}>
                <div className="text-3xl font-bold">{leadAnalysis.leadScore}</div>
                <div className="text-sm opacity-80">Lead Score</div>
                <div className="text-xs mt-1 opacity-60">{leadAnalysis.leadScoreRationale}</div>
              </div>
              <div className={`rounded-xl border p-4 ${getScoreColor(leadAnalysis.winProbability)}`}>
                <div className="text-3xl font-bold">{leadAnalysis.winProbability}%</div>
                <div className="text-sm opacity-80">Win Probability</div>
                <div className="text-xs mt-1 opacity-60">Est. Close: {leadAnalysis.estimatedCloseDate}</div>
              </div>
            </div>

            {/* Recommended Approach */}
            <GlassCard className="p-4">
              <h4 className="font-medium text-white mb-2 flex items-center gap-2">
                <Trophy className="w-4 h-4 text-yellow-400" />
                Recommended Approach
              </h4>
              <p className="text-sm text-white/80">{leadAnalysis.recommendedApproach}</p>
            </GlassCard>

            {/* Key Insights */}
            {leadAnalysis.keyInsights.length > 0 && (
              <GlassCard className="p-4">
                <h4 className="font-medium text-white mb-2 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-400" />
                  Key Insights
                </h4>
                <ul className="space-y-1">
                  {leadAnalysis.keyInsights.map((insight, i) => (
                    <li key={i} className="text-sm text-white/80 flex items-start gap-2">
                      <span className="text-green-400 mt-1">•</span>
                      {insight}
                    </li>
                  ))}
                </ul>
              </GlassCard>
            )}

            {/* Potential Challenges */}
            {leadAnalysis.potentialChallenges.length > 0 && (
              <GlassCard className="p-4">
                <h4 className="font-medium text-white mb-2 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-orange-400" />
                  Potential Challenges
                </h4>
                <ul className="space-y-1">
                  {leadAnalysis.potentialChallenges.map((challenge, i) => (
                    <li key={i} className="text-sm text-white/80 flex items-start gap-2">
                      <span className="text-orange-400 mt-1">•</span>
                      {challenge}
                    </li>
                  ))}
                </ul>
              </GlassCard>
            )}

            {/* Recommended Items for Quote */}
            {leadAnalysis.recommendedItems.length > 0 && (
              <GlassCard className="p-4 border-green-500/30 bg-green-500/5">
                <h4 className="font-medium text-white mb-3 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-green-400" />
                  Recommended Items for Quote
                </h4>
                <div className="space-y-3">
                  {leadAnalysis.recommendedItems.map((item, i) => (
                    <div key={i} className="bg-white/5 rounded-lg p-3">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="font-medium text-white">{item.name}</div>
                          <div className="text-xs text-white/50 mb-1">{item.type}</div>
                          <div className="text-sm text-white/70">{item.description}</div>
                          <div className="text-xs text-white/50 mt-1 italic">{item.rationale}</div>
                        </div>
                        <div className="text-right ml-4">
                          <div className="text-white font-medium">
                            {formatCurrency(item.unitPrice * item.quantity)}
                          </div>
                          <div className="text-xs text-white/50">
                            {item.quantity} × {formatCurrency(item.unitPrice)}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  <div className="flex justify-between items-center pt-3 border-t border-white/10">
                    <span className="text-white/70">Estimated Deal Value</span>
                    <span className="text-xl font-bold text-green-400">
                      {formatCurrency(leadAnalysis.estimatedDealValue)}
                    </span>
                  </div>
                </div>
              </GlassCard>
            )}

            {/* Next Steps */}
            {leadAnalysis.suggestedNextSteps.length > 0 && (
              <GlassCard className="p-4">
                <h4 className="font-medium text-white mb-2 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-blue-400" />
                  Suggested Next Steps
                </h4>
                <ol className="space-y-1">
                  {leadAnalysis.suggestedNextSteps.map((step, i) => (
                    <li key={i} className="text-sm text-white/80 flex items-start gap-2">
                      <span className="text-blue-400 font-medium">{i + 1}.</span>
                      {step}
                    </li>
                  ))}
                </ol>
              </GlassCard>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4 sticky bottom-0 bg-zinc-900/95 py-4 -mx-6 px-6 border-t border-white/10">
            <GlassButton type="button" variant="ghost" onClick={() => setLeadAnalysis(null)} className="flex-1">
              Back to Form
            </GlassButton>
            <GlassButton
              type="button"
              variant="primary"
              onClick={() => handleConvertLead("quote")}
              className="flex-1 gap-2 bg-green-600 hover:bg-green-500"
            >
              <FileText className="w-4 h-4" />
              Convert to Quote
            </GlassButton>
          </div>
        </>
      )}
    </div>
  );

  /* =============================================================================
     RENDER: MAIN MENU
     ============================================================================= */

  const renderMenu = () => (
    <div className="space-y-4">
      <p className="text-sm text-white/60 mb-4">What would you like to record?</p>

      {activityCategories.map((category) => (
        <div key={category.id} className="border border-white/10 rounded-xl overflow-hidden">
          <button
            onClick={() => setExpandedCategory(expandedCategory === category.id ? null : category.id)}
            className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg bg-white/5 ${category.color}`}>
                {category.icon}
              </div>
              <div className="text-left">
                <h3 className="font-medium text-white">{category.label}</h3>
                <p className="text-sm text-white/50">{category.description}</p>
              </div>
            </div>
            <ChevronRight
              className={`w-5 h-5 text-white/40 transition-transform ${
                expandedCategory === category.id ? "rotate-90" : ""
              }`}
            />
          </button>

          {expandedCategory === category.id && (
            <div className="border-t border-white/10 bg-white/[0.02] p-2">
              <div className="grid grid-cols-1 gap-2">
                {category.activities.map((activity) => (
                  <button
                    key={activity.id}
                    onClick={() => setStep(activity.id)}
                    className={`flex items-center gap-3 p-3 rounded-lg border transition-all duration-150 hover:scale-[1.01] ${activity.color}`}
                  >
                    <div className="flex-shrink-0">{activity.icon}</div>
                    <div className="flex-1 text-left">
                      <div className="font-medium text-white text-sm">{activity.label}</div>
                      <div className="text-xs text-white/50">{activity.description}</div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-white/40" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );

  /* =============================================================================
     RENDER: STEP CONTENT
     ============================================================================= */

  const renderContent = () => {
    switch (step) {
      case "menu":
        return renderMenu();

      // Communication activities
      case "log-phone-call":
        return renderActivityForm("phone_call", { options: phoneCallOutcomes, label: "Call Outcome" });
      case "log-email-sent":
        return renderActivityForm("email_sent");
      case "log-email-received":
        return renderActivityForm("email_received");
      case "log-meeting":
        return renderActivityForm("meeting", { options: meetingOutcomes, label: "Meeting Outcome" });
      case "log-site-visit":
        return renderActivityForm("site_visit", { options: meetingOutcomes, label: "Visit Outcome" });

      // Sales process
      case "create-quote":
        return renderQuoteForm();
      case "follow-up-quote":
        return renderActivityForm("quote_followed_up", { options: meetingOutcomes, label: "Follow-up Outcome" });
      case "make-sale":
        return renderSaleForm();
      case "record-deal-won":
        return renderDealWonForm();
      case "record-deal-lost":
        return renderDealLostForm();

      // Fulfillment
      case "schedule-delivery":
        return renderActivityForm("delivery_scheduled");
      case "complete-delivery":
        return renderActivityForm("delivery_completed");
      case "send-payment-reminder":
        return renderActivityForm("payment_reminder_sent");

      // Customer management
      case "log-customer-issue":
        return renderIssueForm();
      case "add-note":
        return renderActivityForm("note");
      case "add-customer":
        return renderCustomerForm();
      case "add-salesperson":
        return renderSalespersonForm();
      case "add-partner":
        return renderPartnerForm();

      // AI tools
      case "analyze-lead":
        return renderLeadAnalysisForm();

      default:
        return renderMenu();
    }
  };

  return (
    <SlideOver open={open} onClose={handleClose} title={getTitle()} width="lg">
      {renderContent()}
    </SlideOver>
  );
}
