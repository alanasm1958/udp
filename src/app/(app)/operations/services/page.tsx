"use client";

import * as React from "react";
import {
  GlassCard,
  GlassButton,
  GlassInput,
  GlassSelect,
  GlassTextarea,
  GlassTable,
  GlassBadge,
  PageHeader,
  Spinner,
  SlideOver,
  useToast,
} from "@/components/ui/glass";
import { apiGet, formatCurrency } from "@/lib/http";

interface Product {
  id: string;
  sku: string;
  name: string;
  unitPrice: string;
  productType: string;
}

interface BasketItem {
  id: string;
  type: "part" | "labor" | "fee";
  productId?: string;
  name: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

interface PriceRecommendation {
  tier: "economy" | "standard" | "premium";
  label: string;
  multiplier: number;
  description: string;
  total: number;
}

interface Party {
  id: string;
  name: string;
}

const SERVICE_QUOTES_KEY = "udp-service-quotes";

interface ServiceQuote {
  id: string;
  customerId: string;
  customerName: string;
  title: string;
  items: BasketItem[];
  selectedTier: "economy" | "standard" | "premium";
  total: number;
  status: "draft" | "sent" | "accepted" | "declined";
  createdAt: string;
}

export default function ServicesPage() {
  const { addToast } = useToast();

  // Basket state
  const [items, setItems] = React.useState<BasketItem[]>([]);
  const [addItemOpen, setAddItemOpen] = React.useState(false);
  const [itemType, setItemType] = React.useState<"part" | "labor" | "fee">("part");
  const [selectedProductId, setSelectedProductId] = React.useState("");
  const [itemName, setItemName] = React.useState("");
  const [itemDescription, setItemDescription] = React.useState("");
  const [itemQuantity, setItemQuantity] = React.useState("1");
  const [itemUnitPrice, setItemUnitPrice] = React.useState("");

  // Quote state
  const [selectedTier, setSelectedTier] = React.useState<"economy" | "standard" | "premium">("standard");
  const [customerId, setCustomerId] = React.useState("");
  const [quoteTitle, setQuoteTitle] = React.useState("");
  const [quotes, setQuotes] = React.useState<ServiceQuote[]>([]);

  // Master data
  const [products, setProducts] = React.useState<Product[]>([]);
  const [customers, setCustomers] = React.useState<Party[]>([]);
  const [loading, setLoading] = React.useState(true);

  // Load master data
  React.useEffect(() => {
    async function loadData() {
      try {
        const [productRes, customerRes] = await Promise.all([
          apiGet<{ items: Product[] }>("/api/master/products?limit=200"),
          apiGet<{ items: Party[] }>("/api/master/parties?type=customer&limit=200"),
        ]);
        setProducts(productRes.items || []);
        setCustomers(customerRes.items || []);
      } catch {
        // Silently fail
      } finally {
        setLoading(false);
      }
    }
    loadData();

    // Load saved quotes
    try {
      const saved = localStorage.getItem(SERVICE_QUOTES_KEY);
      if (saved) {
        setQuotes(JSON.parse(saved));
      }
    } catch {
      // Ignore
    }
  }, []);

  // Calculate totals
  const subtotal = items.reduce((sum, item) => sum + item.total, 0);

  // Price recommendations with guardrails
  const priceRecommendations: PriceRecommendation[] = [
    {
      tier: "economy",
      label: "Economy",
      multiplier: 1.0,
      description: "Base cost with minimal margin. Use for price-sensitive customers or competitive situations.",
      total: subtotal * 1.15, // 15% margin
    },
    {
      tier: "standard",
      label: "Standard",
      multiplier: 1.3,
      description: "Recommended pricing with healthy margin. Best for most customers.",
      total: subtotal * 1.35, // 35% margin
    },
    {
      tier: "premium",
      label: "Premium",
      multiplier: 1.6,
      description: "Premium pricing for high-value services. Includes priority support and warranty.",
      total: subtotal * 1.55, // 55% margin
    },
  ];

  const selectedPrice = priceRecommendations.find((p) => p.tier === selectedTier)!;

  // Add item to basket
  const handleAddItem = () => {
    const quantity = parseFloat(itemQuantity) || 1;
    let unitPrice = parseFloat(itemUnitPrice) || 0;
    let name = itemName;

    // If part type and product selected, use product data
    if (itemType === "part" && selectedProductId) {
      const product = products.find((p) => p.id === selectedProductId);
      if (product) {
        name = product.name;
        unitPrice = parseFloat(product.unitPrice) || 0;
      }
    }

    if (!name) {
      addToast("error", "Item name is required");
      return;
    }

    const newItem: BasketItem = {
      id: `item-${Date.now()}`,
      type: itemType,
      productId: itemType === "part" ? selectedProductId : undefined,
      name,
      description: itemDescription,
      quantity,
      unitPrice,
      total: quantity * unitPrice,
    };

    setItems([...items, newItem]);
    setAddItemOpen(false);
    resetItemForm();
    addToast("success", "Item added to basket");
  };

  const resetItemForm = () => {
    setItemType("part");
    setSelectedProductId("");
    setItemName("");
    setItemDescription("");
    setItemQuantity("1");
    setItemUnitPrice("");
  };

  const handleRemoveItem = (itemId: string) => {
    setItems(items.filter((i) => i.id !== itemId));
  };

  const handleSaveQuote = () => {
    if (!customerId) {
      addToast("error", "Please select a customer");
      return;
    }
    if (items.length === 0) {
      addToast("error", "Please add at least one item");
      return;
    }

    const customer = customers.find((c) => c.id === customerId);
    const newQuote: ServiceQuote = {
      id: `sq-${Date.now()}`,
      customerId,
      customerName: customer?.name || "Unknown",
      title: quoteTitle || `Service Quote for ${customer?.name || "Customer"}`,
      items: [...items],
      selectedTier,
      total: selectedPrice.total,
      status: "draft",
      createdAt: new Date().toISOString(),
    };

    const updatedQuotes = [...quotes, newQuote];
    setQuotes(updatedQuotes);
    try {
      localStorage.setItem(SERVICE_QUOTES_KEY, JSON.stringify(updatedQuotes));
    } catch {
      // Ignore
    }

    // Reset form
    setItems([]);
    setCustomerId("");
    setQuoteTitle("");
    setSelectedTier("standard");
    addToast("success", "Service quote saved");
  };

  const handleDeleteQuote = (quoteId: string) => {
    const updatedQuotes = quotes.filter((q) => q.id !== quoteId);
    setQuotes(updatedQuotes);
    try {
      localStorage.setItem(SERVICE_QUOTES_KEY, JSON.stringify(updatedQuotes));
    } catch {
      // Ignore
    }
    addToast("success", "Quote deleted");
  };

  const handleUpdateQuoteStatus = (quoteId: string, status: ServiceQuote["status"]) => {
    const updatedQuotes = quotes.map((q) => (q.id === quoteId ? { ...q, status } : q));
    setQuotes(updatedQuotes);
    try {
      localStorage.setItem(SERVICE_QUOTES_KEY, JSON.stringify(updatedQuotes));
    } catch {
      // Ignore
    }
    addToast("success", `Quote marked as ${status}`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Service Quotes"
        description="Build modular service quotes with parts, labor, and fees"
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Basket Builder */}
        <div className="lg:col-span-2 space-y-4">
          {/* Customer Selection */}
          <GlassCard>
            <div className="flex flex-wrap items-end gap-4">
              <div className="flex-1 min-w-[200px]">
                <GlassSelect
                  label="Customer"
                  value={customerId}
                  onChange={(e) => setCustomerId(e.target.value)}
                  options={[
                    { value: "", label: "Select customer..." },
                    ...customers.map((c) => ({ value: c.id, label: c.name })),
                  ]}
                />
              </div>
              <div className="flex-1 min-w-[200px]">
                <GlassInput
                  label="Quote Title (Optional)"
                  value={quoteTitle}
                  onChange={(e) => setQuoteTitle(e.target.value)}
                  placeholder="e.g., HVAC Installation"
                />
              </div>
            </div>
          </GlassCard>

          {/* Basket Items */}
          <GlassCard>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Service Basket</h3>
              <GlassButton onClick={() => setAddItemOpen(true)}>
                <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                Add Item
              </GlassButton>
            </div>

            {items.length === 0 ? (
              <div className="text-center py-8 text-white/50">
                <p>No items in basket. Add parts, labor, or fees to build your service quote.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <GlassBadge
                        variant={
                          item.type === "part"
                            ? "info"
                            : item.type === "labor"
                            ? "success"
                            : "warning"
                        }
                      >
                        {item.type}
                      </GlassBadge>
                      <div>
                        <p className="text-sm font-medium text-white">{item.name}</p>
                        {item.description && (
                          <p className="text-xs text-white/50">{item.description}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-sm text-white/70">
                          {item.quantity} x {formatCurrency(item.unitPrice)}
                        </p>
                        <p className="text-sm font-medium text-white">
                          {formatCurrency(item.total)}
                        </p>
                      </div>
                      <button
                        onClick={() => handleRemoveItem(item.id)}
                        className="p-1.5 text-white/40 hover:text-red-400 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}

                <div className="flex justify-between pt-4 border-t border-white/10">
                  <span className="text-white/70">Cost Subtotal</span>
                  <span className="font-semibold text-white">{formatCurrency(subtotal)}</span>
                </div>
              </div>
            )}
          </GlassCard>
        </div>

        {/* Right: Pricing Recommendations */}
        <div className="space-y-4">
          <GlassCard>
            <h3 className="text-lg font-semibold text-white mb-4">Pricing Recommendations</h3>
            <div className="space-y-3">
              {priceRecommendations.map((rec) => (
                <button
                  key={rec.tier}
                  onClick={() => setSelectedTier(rec.tier)}
                  className={`w-full p-4 rounded-xl text-left transition-all ${
                    selectedTier === rec.tier
                      ? "bg-blue-500/20 border-2 border-blue-500/50"
                      : "bg-white/5 border-2 border-transparent hover:bg-white/10"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span
                      className={`text-sm font-medium ${
                        rec.tier === "economy"
                          ? "text-emerald-400"
                          : rec.tier === "standard"
                          ? "text-blue-400"
                          : "text-purple-400"
                      }`}
                    >
                      {rec.label}
                    </span>
                    <span className="text-lg font-bold text-white">
                      {formatCurrency(rec.total)}
                    </span>
                  </div>
                  <p className="text-xs text-white/50">{rec.description}</p>
                </button>
              ))}
            </div>

            {items.length > 0 && (
              <div className="mt-6 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-white/70">Selected Price</span>
                  <span className="text-2xl font-bold text-emerald-400">
                    {formatCurrency(selectedPrice.total)}
                  </span>
                </div>
                <p className="text-xs text-white/50 mb-4">
                  Margin: {formatCurrency(selectedPrice.total - subtotal)} (
                  {Math.round(((selectedPrice.total - subtotal) / subtotal) * 100)}%)
                </p>
                <GlassButton
                  variant="primary"
                  className="w-full"
                  onClick={handleSaveQuote}
                  disabled={!customerId || items.length === 0}
                >
                  Save Quote
                </GlassButton>
              </div>
            )}
          </GlassCard>

          {/* Guardrails */}
          <GlassCard className="!bg-amber-500/10 border border-amber-500/20">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-amber-500/20">
                <svg className="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-amber-400 mb-1">Pricing Guardrails</p>
                <ul className="text-xs text-white/60 space-y-1">
                  <li>• Economy: Minimum 15% margin</li>
                  <li>• Standard: Target 35% margin</li>
                  <li>• Premium: Up to 55% margin</li>
                </ul>
              </div>
            </div>
          </GlassCard>
        </div>
      </div>

      {/* Saved Quotes */}
      {quotes.length > 0 && (
        <GlassCard>
          <h3 className="text-lg font-semibold text-white mb-4">Saved Quotes</h3>
          <GlassTable
            headers={["Quote", "Customer", "Items", "Total", "Status", ""]}
            rightAlignColumns={[3]}
            rows={quotes.map((q) => [
              <div key="title">
                <p className="text-sm font-medium text-white">{q.title}</p>
                <p className="text-xs text-white/50">{new Date(q.createdAt).toLocaleDateString()}</p>
              </div>,
              q.customerName,
              `${q.items.length} items`,
              formatCurrency(q.total),
              <GlassBadge
                key="status"
                variant={
                  q.status === "accepted"
                    ? "success"
                    : q.status === "declined"
                    ? "danger"
                    : q.status === "sent"
                    ? "info"
                    : "default"
                }
              >
                {q.status}
              </GlassBadge>,
              <div key="actions" className="flex items-center gap-2">
                {q.status === "draft" && (
                  <button
                    onClick={() => handleUpdateQuoteStatus(q.id, "sent")}
                    className="text-xs text-blue-400 hover:text-blue-300"
                  >
                    Mark Sent
                  </button>
                )}
                {q.status === "sent" && (
                  <>
                    <button
                      onClick={() => handleUpdateQuoteStatus(q.id, "accepted")}
                      className="text-xs text-emerald-400 hover:text-emerald-300"
                    >
                      Accept
                    </button>
                    <button
                      onClick={() => handleUpdateQuoteStatus(q.id, "declined")}
                      className="text-xs text-red-400 hover:text-red-300"
                    >
                      Decline
                    </button>
                  </>
                )}
                <button
                  onClick={() => handleDeleteQuote(q.id)}
                  className="text-xs text-white/40 hover:text-red-400"
                >
                  Delete
                </button>
              </div>,
            ])}
          />
        </GlassCard>
      )}

      {/* Add Item SlideOver */}
      <SlideOver
        open={addItemOpen}
        onClose={() => {
          setAddItemOpen(false);
          resetItemForm();
        }}
        title="Add Item to Basket"
      >
        <div className="space-y-4">
          <GlassSelect
            label="Item Type"
            value={itemType}
            onChange={(e) => setItemType(e.target.value as "part" | "labor" | "fee")}
            options={[
              { value: "part", label: "Part / Material" },
              { value: "labor", label: "Labor / Service" },
              { value: "fee", label: "Fee / Charge" },
            ]}
          />

          {itemType === "part" && (
            <GlassSelect
              label="Select Product"
              value={selectedProductId}
              onChange={(e) => {
                setSelectedProductId(e.target.value);
                const product = products.find((p) => p.id === e.target.value);
                if (product) {
                  setItemName(product.name);
                  setItemUnitPrice(product.unitPrice);
                }
              }}
              options={[
                { value: "", label: "Select from catalog..." },
                ...products.map((p) => ({
                  value: p.id,
                  label: `${p.sku || "N/A"} - ${p.name} (${formatCurrency(parseFloat(p.unitPrice))})`,
                })),
              ]}
            />
          )}

          {(itemType !== "part" || !selectedProductId) && (
            <GlassInput
              label="Item Name"
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              placeholder={
                itemType === "labor"
                  ? "e.g., Installation - 2 hours"
                  : itemType === "fee"
                  ? "e.g., Disposal Fee"
                  : "e.g., Custom Part"
              }
            />
          )}

          <GlassTextarea
            label="Description (Optional)"
            value={itemDescription}
            onChange={(e) => setItemDescription(e.target.value)}
            placeholder="Additional details..."
            rows={2}
          />

          <div className="grid grid-cols-2 gap-4">
            <GlassInput
              label="Quantity"
              type="number"
              min="0.01"
              step="0.01"
              value={itemQuantity}
              onChange={(e) => setItemQuantity(e.target.value)}
            />
            <GlassInput
              label="Unit Price"
              type="number"
              min="0"
              step="0.01"
              value={itemUnitPrice}
              onChange={(e) => setItemUnitPrice(e.target.value)}
              placeholder="0.00"
            />
          </div>

          {itemQuantity && itemUnitPrice && (
            <div className="p-3 rounded-xl bg-white/5">
              <div className="flex justify-between">
                <span className="text-sm text-white/70">Line Total</span>
                <span className="font-semibold text-white">
                  {formatCurrency((parseFloat(itemQuantity) || 0) * (parseFloat(itemUnitPrice) || 0))}
                </span>
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <GlassButton onClick={handleAddItem} className="flex-1">
              Add to Basket
            </GlassButton>
            <GlassButton
              variant="ghost"
              onClick={() => {
                setAddItemOpen(false);
                resetItemForm();
              }}
            >
              Cancel
            </GlassButton>
          </div>
        </div>
      </SlideOver>
    </div>
  );
}
