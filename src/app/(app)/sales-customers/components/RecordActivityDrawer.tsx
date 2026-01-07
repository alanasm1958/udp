"use client";

import * as React from "react";
import {
  GlassCard,
  GlassButton,
  GlassInput,
  GlassTextarea,
  GlassSelect,
  SlideOver,
  Spinner,
  useToast,
} from "@/components/ui/glass";
import { apiGet, apiPost, formatCurrency } from "@/lib/http";

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

interface LineItem {
  id: string;
  itemId: string;
  itemName: string;
  itemType: string;
  description: string;
  quantity: number;
  unitPrice: number;
  cost: number; // Hidden from customer
  discountPercent: number;
  taxAmount: number;
  lineTotal: number;
}

type DrawerStep =
  | "menu"
  | "make-sale"
  | "create-quote"
  | "add-customer"
  | "add-salesperson"
  | "add-partner"
  | "analyze-lead";

/* =============================================================================
   ICONS
   ============================================================================= */

const Icons = {
  chevronRight: (
    <svg className="w-5 h-5 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  ),
  invoice: (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    </svg>
  ),
  quote: (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.423-.077m3.5 0a48.424 48.424 0 00-1.423.077c-1.131.094-1.976 1.057-1.976 2.192V18.75m0 0a2.25 2.25 0 002.25 2.25h.75a2.25 2.25 0 002.25-2.25v-3.375c0-.621-.504-1.125-1.125-1.125H15m-9 0V9.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V18.75m0 0a2.25 2.25 0 002.25 2.25h.75a2.25 2.25 0 002.25-2.25v-3.375c0-.621-.504-1.125-1.125-1.125H9m-9 0V9.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V18.75m0 0a2.25 2.25 0 002.25 2.25h.75a2.25 2.25 0 002.25-2.25v-3.375c0-.621-.504-1.125-1.125-1.125H9" />
    </svg>
  ),
  customer: (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
    </svg>
  ),
  salesperson: (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
    </svg>
  ),
  partner: (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.059 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
    </svg>
  ),
  analyze: (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
    </svg>
  ),
};

/* =============================================================================
   ACTIVITY OPTIONS
   ============================================================================= */

const activityOptions = [
  {
    id: "make-sale" as DrawerStep,
    label: "Make a Sale (Invoice)",
    description: "Create an invoice for a completed sale. This will create accounts receivable entries.",
    icon: Icons.invoice,
    color: "border-blue-500/30 bg-blue-500/10 hover:bg-blue-500/20",
  },
  {
    id: "create-quote" as DrawerStep,
    label: "Create a Quote",
    description: "Send a price quote to a customer or partner. They can accept it later to convert to a sale.",
    icon: Icons.quote,
    color: "border-green-500/30 bg-green-500/10 hover:bg-green-500/20",
  },
  {
    id: "add-customer" as DrawerStep,
    label: "Add a Customer",
    description: "Register a new customer who can purchase from you. They'll appear in your customer list.",
    icon: Icons.customer,
    color: "border-purple-500/30 bg-purple-500/10 hover:bg-purple-500/20",
  },
  {
    id: "add-salesperson" as DrawerStep,
    label: "Add a Sales Person",
    description: "Add someone from your team who handles sales. You can assign sales and quotes to them.",
    icon: Icons.salesperson,
    color: "border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20",
  },
  {
    id: "add-partner" as DrawerStep,
    label: "Add a Partner",
    description: "Register a partner organization. Partners can receive quotes and make sales with you.",
    icon: Icons.partner,
    color: "border-indigo-500/30 bg-indigo-500/10 hover:bg-indigo-500/20",
  },
  {
    id: "analyze-lead" as DrawerStep,
    label: "Analyze Lead",
    description: "Use AI to analyze a potential lead. Get insights and convert them to quotes or sales.",
    icon: Icons.analyze,
    color: "border-pink-500/30 bg-pink-500/10 hover:bg-pink-500/20",
  },
];

/* =============================================================================
   MAIN COMPONENT
   ============================================================================= */

interface RecordActivityDrawerProps {
  open: boolean;
  onClose: () => void;
  onActivityCreated?: () => void;
}

export function RecordActivityDrawer({ open, onClose, onActivityCreated }: RecordActivityDrawerProps) {
  const { addToast } = useToast();
  const [step, setStep] = React.useState<DrawerStep>("menu");
  const [loading, setLoading] = React.useState(false);

  // Data
  const [items, setItems] = React.useState<Item[]>([]);
  const [products, setProducts] = React.useState<Array<{ id: string; sku: string | null; name: string }>>([]);
  const [customers, setCustomers] = React.useState<Customer[]>([]);
  const [parties, setParties] = React.useState<Party[]>([]);
  const [salespersons, setSalespersons] = React.useState<Salesperson[]>([]);

  // Sale/Quote forms
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
    budget: "",
    timeline: "",
    requirements: "",
    source: "",
    notes: "",
  });
  const [leadAnalysis, setLeadAnalysis] = React.useState<string | null>(null);
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
      ]).then(([itemsRes, productsRes, customersRes, partiesRes, salespersonsRes]) => {
        setItems(itemsRes.items || []);
        setProducts(productsRes.items || []);
        setCustomers(customersRes.items || []);
        // Partners are parties with type "other"
        setParties(partiesRes.items || []);
        setSalespersons(salespersonsRes.items || []);
      });
    }
  }, [open]);

  const handleClose = () => {
    setStep("menu");
    setLineItems([]);
    setShowAddItem(false);
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
    onClose();
  };

  const handleBack = () => {
    if (step !== "menu") {
      setStep("menu");
      setLineItems([]);
      setShowAddItem(false);
      setLeadAnalysis(null);
    }
  };

  // Calculate totals
  const calculateTotals = () => {
    const subtotal = lineItems.reduce((sum, item) => sum + item.lineTotal, 0);
    const totalCost = lineItems.reduce((sum, item) => sum + item.cost * item.quantity, 0);
    const tax = subtotal * 0.1; // 10% tax - can be made configurable
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
    const taxAmount = lineSubtotal * 0.1; // 10% tax
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

  // Remove line item
  const handleRemoveLineItem = (id: string) => {
    setLineItems(lineItems.filter((item) => item.id !== id));
  };

  // Create sale
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

      // Create document
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

      // Add line items
      for (const lineItem of lineItems) {
        // Find product by matching item SKU or name
        const item = items.find((i) => i.id === lineItem.itemId);
        let productId: string | null = null;
        if (item) {
          // Try to find product by SKU first, then by name
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
            cost: lineItem.cost, // Hidden from customer
            itemId: lineItem.itemId, // Store item reference
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

  // Create quote
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
        // Find product by matching item SKU or name
        const item = items.find((i) => i.id === lineItem.itemId);
        let productId: string | null = null;
        if (item) {
          // Try to find product by SKU first, then by name
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
            cost: lineItem.cost, // Hidden from customer
            itemId: lineItem.itemId, // Store item reference
          },
        });
      }

      addToast("success", "Quote created successfully!");
      handleClose();
      onActivityCreated?.();
    } catch (error) {
      addToast("error", error instanceof Error ? error.message : "Failed to create quote");
    } finally {
      setLoading(false);
    }
  };

  // Add customer
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

  // Add salesperson
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

  // Add partner
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
          data: {
            email: partnerForm.email || null,
            phone: partnerForm.phone || null,
          },
        });
      }
      if (partnerForm.address) {
        profiles.push({
          profileType: "address",
          data: {
            address: partnerForm.address,
          },
        });
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

  // Analyze lead
  const handleAnalyzeLead = async () => {
    if (!leadForm.name && !leadForm.email && !leadForm.company) {
      addToast("error", "Please provide at least name, email, or company");
      return;
    }

    setAnalyzing(true);
    try {
      // Call AI analysis endpoint
      const analysis = await apiPost<{ analysis: string }>("/api/ai/analyze-lead", {
        name: leadForm.name,
        email: leadForm.email,
        phone: leadForm.phone,
        company: leadForm.company,
        industry: leadForm.industry,
        budget: leadForm.budget,
        timeline: leadForm.timeline,
        requirements: leadForm.requirements,
        source: leadForm.source,
        notes: leadForm.notes,
      });

      setLeadAnalysis(analysis.analysis || "Analysis completed. Review the details below.");
    } catch (error) {
      // If endpoint doesn't exist, create a simple analysis
      const mockAnalysis = `Lead Analysis for ${leadForm.name || leadForm.company || "Unknown"}:

Industry: ${leadForm.industry || "Not specified"}
Budget: ${leadForm.budget || "Not specified"}
Timeline: ${leadForm.timeline || "Not specified"}
Requirements: ${leadForm.requirements || "Not specified"}

Recommendation: ${leadForm.budget && parseFloat(leadForm.budget) > 10000 ? "High-value lead - prioritize follow-up" : "Standard lead - follow standard process"}`;
      setLeadAnalysis(mockAnalysis);
    } finally {
      setAnalyzing(false);
    }
  };

  // Convert lead to quote or sale
  const handleConvertLead = async (type: "quote" | "sale") => {
    // Create customer first if needed
    let customerId = "";
    try {
      const customer = await apiPost<{ id: string }>("/api/sales-customers/customers", {
        name: leadForm.name || leadForm.company || "Lead Customer",
        email: leadForm.email || undefined,
        phone: leadForm.phone || undefined,
        notes: `Converted from lead. ${leadForm.notes || ""}`,
      });
      customerId = customer.id;
    } catch {
      addToast("error", "Failed to create customer from lead");
      return;
    }

    if (type === "quote") {
      setQuoteForm({ ...quoteForm, partyId: customerId, partyType: "customer" });
      setStep("create-quote");
      setLeadAnalysis(null);
    } else {
      setSaleForm({ ...saleForm, partyId: customerId, partyType: "customer" });
      setStep("make-sale");
      setLeadAnalysis(null);
    }
  };

  const getTitle = () => {
    switch (step) {
      case "make-sale":
        return "Make a Sale";
      case "create-quote":
        return "Create a Quote";
      case "add-customer":
        return "Add a Customer";
      case "add-salesperson":
        return "Add a Sales Person";
      case "add-partner":
        return "Add a Partner";
      case "analyze-lead":
        return "Analyze Lead";
      default:
        return "Record Activity";
    }
  };

  const totals = calculateTotals();

  return (
    <SlideOver open={open} onClose={handleClose} title={getTitle()} width="lg">
      {step === "menu" ? (
        <div className="space-y-2">
          <p className="text-sm text-white/60 mb-6">What would you like to do?</p>
          {activityOptions.map((option) => (
            <button
              key={option.id}
              onClick={() => setStep(option.id)}
              className={`w-full flex items-center gap-4 p-4 rounded-xl border transition-all duration-150 hover:scale-[1.01] hover:shadow-lg ${option.color}`}
            >
              <div className="flex-shrink-0">{option.icon}</div>
              <div className="flex-1 text-left">
                <div className="font-medium text-white">{option.label}</div>
                <div className="text-sm text-white/50">{option.description}</div>
              </div>
              {Icons.chevronRight}
            </button>
          ))}
        </div>
      ) : step === "make-sale" || step === "create-quote" ? (
        <div className="space-y-6">
          <button onClick={handleBack} className="flex items-center gap-2 text-sm text-white/60 hover:text-white transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
            Back
          </button>

          {/* Party Selection */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-white/70 mb-1.5">Type</label>
              <select
                value={step === "make-sale" ? saleForm.partyType : quoteForm.partyType}
                onChange={(e) => {
                  if (step === "make-sale") {
                    setSaleForm({ ...saleForm, partyType: e.target.value as "customer" | "partner", partyId: "" });
                  } else {
                    setQuoteForm({ ...quoteForm, partyType: e.target.value as "customer" | "partner", partyId: "" });
                  }
                }}
                className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-white/25"
              >
                <option value="customer" className="bg-zinc-900">Customer</option>
                <option value="partner" className="bg-zinc-900">Partner</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-white/70 mb-1.5">
                {step === "make-sale" ? saleForm.partyType === "customer" ? "Customer" : "Partner" : quoteForm.partyType === "customer" ? "Customer" : "Partner"} *
              </label>
              <select
                value={step === "make-sale" ? saleForm.partyId : quoteForm.partyId}
                onChange={(e) => {
                  if (step === "make-sale") {
                    setSaleForm({ ...saleForm, partyId: e.target.value });
                  } else {
                    setQuoteForm({ ...quoteForm, partyId: e.target.value });
                  }
                }}
                className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-white/25"
              >
                <option value="" className="bg-zinc-900">Select...</option>
                {(step === "make-sale"
                  ? (saleForm.partyType === "customer" ? customers : parties)
                  : (quoteForm.partyType === "customer" ? customers : parties)
                ).map((p: { id: string; name: string; code: string }) => (
                  <option key={p.id} value={p.id} className="bg-zinc-900">
                    {p.name} ({p.code})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Salesperson Assignment */}
          <div>
            <label className="block text-sm font-medium text-white/70 mb-1.5">Assign to Sales Person (Optional)</label>
            <select
              value={step === "make-sale" ? saleForm.salespersonId : quoteForm.salespersonId}
              onChange={(e) => {
                if (step === "make-sale") {
                  setSaleForm({ ...saleForm, salespersonId: e.target.value });
                } else {
                  setQuoteForm({ ...quoteForm, salespersonId: e.target.value });
                }
              }}
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
                value={step === "make-sale" ? saleForm.docDate : quoteForm.docDate}
                onChange={(e) => {
                  if (step === "make-sale") {
                    setSaleForm({ ...saleForm, docDate: e.target.value });
                  } else {
                    setQuoteForm({ ...quoteForm, docDate: e.target.value });
                  }
                }}
                className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-white/25"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-white/70 mb-1.5">
                {step === "make-sale" ? "Due Date" : "Expiry Date"}
              </label>
              <input
                type="date"
                value={step === "make-sale" ? saleForm.dueDate : quoteForm.expiryDate}
                onChange={(e) => {
                  if (step === "make-sale") {
                    setSaleForm({ ...saleForm, dueDate: e.target.value });
                  } else {
                    setQuoteForm({ ...quoteForm, expiryDate: e.target.value });
                  }
                }}
                className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-white/25"
              />
            </div>
          </div>

          {/* Line Items */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-medium text-white/70">Items</label>
              <GlassButton
                type="button"
                variant="ghost"
                onClick={() => setShowAddItem(true)}
                className="text-sm"
              >
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
                        <div className="text-xs text-white/40 mt-1">
                          Cost: {formatCurrency(item.cost * item.quantity)} (hidden from customer)
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
                  <div className="flex justify-between text-xs pt-1">
                    <span className="text-white/40">Total Cost (internal):</span>
                    <span className="text-white/40">{formatCurrency(totals.totalCost)}</span>
                  </div>
                </div>
              </GlassCard>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-white/70 mb-1.5">Notes (Optional)</label>
            <textarea
              value={step === "make-sale" ? saleForm.notes : quoteForm.notes}
              onChange={(e) => {
                if (step === "make-sale") {
                  setSaleForm({ ...saleForm, notes: e.target.value });
                } else {
                  setQuoteForm({ ...quoteForm, notes: e.target.value });
                }
              }}
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
              onClick={step === "make-sale" ? handleCreateSale : handleCreateQuote}
              disabled={loading || lineItems.length === 0}
              className="flex-1"
            >
              {loading ? <Spinner size="sm" /> : step === "make-sale" ? "Create Sale" : "Create Quote"}
            </GlassButton>
          </div>
        </div>
      ) : step === "add-customer" ? (
        <div className="space-y-5">
          <button onClick={handleBack} className="flex items-center gap-2 text-sm text-white/60 hover:text-white transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
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
      ) : step === "add-salesperson" ? (
        <div className="space-y-5">
          <button onClick={handleBack} className="flex items-center gap-2 text-sm text-white/60 hover:text-white transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
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
      ) : step === "add-partner" ? (
        <div className="space-y-5">
          <button onClick={handleBack} className="flex items-center gap-2 text-sm text-white/60 hover:text-white transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
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
      ) : step === "analyze-lead" ? (
        <div className="space-y-5">
          <button onClick={handleBack} className="flex items-center gap-2 text-sm text-white/60 hover:text-white transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
            Back
          </button>

          {!leadAnalysis ? (
            <>
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 mb-4">
                <p className="text-sm text-white/80">
                  Fill out the lead information below. Our AI will analyze the lead and provide insights to help you decide the best next steps.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <GlassInput
                  label="Lead Name"
                  placeholder="Contact name"
                  value={leadForm.name}
                  onChange={(e) => setLeadForm({ ...leadForm, name: e.target.value })}
                />
                <GlassInput
                  label="Company"
                  placeholder="Company name"
                  value={leadForm.company}
                  onChange={(e) => setLeadForm({ ...leadForm, company: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <GlassInput
                  label="Email"
                  type="email"
                  placeholder="lead@example.com"
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

              <div className="grid grid-cols-2 gap-4">
                <GlassInput
                  label="Industry"
                  placeholder="e.g., Technology, Healthcare"
                  value={leadForm.industry}
                  onChange={(e) => setLeadForm({ ...leadForm, industry: e.target.value })}
                />
                <GlassInput
                  label="Budget"
                  placeholder="e.g., $10,000"
                  value={leadForm.budget}
                  onChange={(e) => setLeadForm({ ...leadForm, budget: e.target.value })}
                />
              </div>

              <GlassInput
                label="Timeline"
                placeholder="e.g., Q1 2024, ASAP"
                value={leadForm.timeline}
                onChange={(e) => setLeadForm({ ...leadForm, timeline: e.target.value })}
              />

              <GlassTextarea
                label="Requirements"
                placeholder="What are they looking for?"
                value={leadForm.requirements}
                onChange={(e) => setLeadForm({ ...leadForm, requirements: e.target.value })}
                rows={3}
              />

              <GlassInput
                label="Source"
                placeholder="e.g., Website, Referral, Trade Show"
                value={leadForm.source}
                onChange={(e) => setLeadForm({ ...leadForm, source: e.target.value })}
              />

              <GlassTextarea
                label="Notes"
                placeholder="Additional information..."
                value={leadForm.notes}
                onChange={(e) => setLeadForm({ ...leadForm, notes: e.target.value })}
                rows={2}
              />

              <div className="flex gap-3 pt-4">
                <GlassButton type="button" variant="ghost" onClick={handleClose} className="flex-1">
                  Cancel
                </GlassButton>
                <GlassButton type="button" variant="primary" onClick={handleAnalyzeLead} disabled={analyzing} className="flex-1">
                  {analyzing ? <Spinner size="sm" /> : "Analyze Lead"}
                </GlassButton>
              </div>
            </>
          ) : (
            <>
              <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4 mb-4">
                <h3 className="font-medium text-white mb-2">AI Analysis Results</h3>
                <div className="text-sm text-white/80 whitespace-pre-wrap">{leadAnalysis}</div>
              </div>

              <div className="flex gap-3 pt-4">
                <GlassButton type="button" variant="ghost" onClick={() => setLeadAnalysis(null)} className="flex-1">
                  Back to Form
                </GlassButton>
                <GlassButton
                  type="button"
                  variant="ghost"
                  onClick={() => handleConvertLead("quote")}
                  className="flex-1"
                >
                  Convert to Quote
                </GlassButton>
                <GlassButton type="button" variant="primary" onClick={() => handleConvertLead("sale")} className="flex-1">
                  Convert to Sale
                </GlassButton>
              </div>
            </>
          )}
        </div>
      ) : null}
    </SlideOver>
  );
}
