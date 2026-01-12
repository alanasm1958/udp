"use client";

import { useState, useEffect } from "react";
import {
  GlassInput,
  GlassSelect,
  GlassTextarea,
  GlassButton,
  GlassCard,
  useToast,
} from "@/components/ui/glass";
import { ArrowLeft, Info, Plus, Trash2 } from "lucide-react";

interface ReceiveStockFormProps {
  onBack: () => void;
  onSuccess: () => void;
}

interface Item {
  id: string;
  name: string;
  sku: string | null;
}

interface Warehouse {
  id: string;
  name: string;
}

interface LineItem {
  itemId: string;
  itemName: string;
  quantity: string;
  warehouseId: string;
  lotNumber: string;
  notes: string;
}

export default function ReceiveStockForm({ onBack, onSuccess }: ReceiveStockFormProps) {
  const { addToast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);

  const [formData, setFormData] = useState({
    receiptDate: new Date().toISOString().split("T")[0],
    vendorInvoice: "",
    notes: "",
  });

  const [lineItems, setLineItems] = useState<LineItem[]>([
    { itemId: "", itemName: "", quantity: "", warehouseId: "", lotNumber: "", notes: "" },
  ]);

  useEffect(() => {
    loadItems();
    loadWarehouses();
  }, []);

  const loadItems = async () => {
    try {
      const res = await fetch("/api/master/items?limit=100");
      if (res.ok) {
        const data = await res.json();
        setItems(data.items?.filter((i: Item & { trackInventory: boolean }) => i.trackInventory) || []);
      }
    } catch (error) {
      console.error("Error loading items:", error);
    }
  };

  const loadWarehouses = async () => {
    try {
      const res = await fetch("/api/master/warehouses");
      if (res.ok) {
        const data = await res.json();
        setWarehouses(data.warehouses || []);
      }
    } catch (error) {
      console.error("Error loading warehouses:", error);
    }
  };

  const updateField = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const updateLineItem = (index: number, field: keyof LineItem, value: string) => {
    setLineItems((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };

      // Auto-fill item name when item is selected
      if (field === "itemId") {
        const item = items.find((i) => i.id === value);
        if (item) {
          updated[index].itemName = item.name;
        }
      }

      return updated;
    });
  };

  const addLineItem = () => {
    setLineItems((prev) => [
      ...prev,
      { itemId: "", itemName: "", quantity: "", warehouseId: "", lotNumber: "", notes: "" },
    ]);
  };

  const removeLineItem = (index: number) => {
    if (lineItems.length > 1) {
      setLineItems((prev) => prev.filter((_, i) => i !== index));
    }
  };

  const handleSubmit = async () => {
    try {
      setIsSubmitting(true);

      const validLines = lineItems.filter((line) => line.itemId && line.quantity && line.warehouseId);

      if (validLines.length === 0) {
        addToast("error", "At least one line item is required");
        return;
      }

      // Use inventory movements API
      for (const line of validLines) {
        const res = await fetch("/api/operations/inventory-movements", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "receipt",
            itemId: line.itemId,
            warehouseId: line.warehouseId,
            quantity: parseFloat(line.quantity),
            date: formData.receiptDate,
            reference: formData.vendorInvoice || null,
            notes: line.notes || formData.notes || null,
            lotNumber: line.lotNumber || null,
          }),
        });

        if (!res.ok) {
          const error = await res.json();
          addToast("error", error.message || `Failed to receive ${line.itemName}`);
          return;
        }
      }

      onSuccess();
    } catch (error) {
      console.error("Error receiving stock:", error);
      addToast("error", "Failed to receive stock");
    } finally {
      setIsSubmitting(false);
    }
  };

  const InfoTooltip = ({ text }: { text: string }) => (
    <div className="group relative inline-block ml-2">
      <Info className="w-4 h-4 text-white/40 cursor-help" />
      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 hidden group-hover:block z-50 w-64">
        <div className="bg-gray-900 text-white text-xs rounded-lg p-3 shadow-xl border border-white/10">
          {text}
        </div>
      </div>
    </div>
  );

  const itemOptions = [
    { value: "", label: "Select item..." },
    ...items.map((i) => ({ value: i.id, label: `${i.name}${i.sku ? ` (${i.sku})` : ""}` })),
  ];

  const warehouseOptions = [
    { value: "", label: "Select warehouse..." },
    ...warehouses.map((w) => ({ value: w.id, label: w.name })),
  ];

  return (
    <div className="space-y-6">
      <GlassButton onClick={onBack} variant="ghost" size="sm">
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to menu
      </GlassButton>

      {/* Receipt Info */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold flex items-center">
          Receipt Information
          <InfoTooltip text="Basic details about this stock receipt" />
        </h3>

        <div className="grid grid-cols-2 gap-4">
          <GlassInput
            label="Receipt Date *"
            type="date"
            value={formData.receiptDate}
            onChange={(e) => updateField("receiptDate", e.target.value)}
          />
          <GlassInput
            label="Vendor Invoice #"
            value={formData.vendorInvoice}
            onChange={(e) => updateField("vendorInvoice", e.target.value)}
            placeholder="INV-12345"
          />
        </div>
      </div>

      {/* Line Items */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold flex items-center">
            Items to Receive
            <InfoTooltip text="Add items and quantities to receive" />
          </h3>
          <GlassButton onClick={addLineItem} variant="ghost" size="sm">
            <Plus className="w-4 h-4 mr-2" />
            Add Item
          </GlassButton>
        </div>

        {lineItems.map((line, index) => (
          <GlassCard key={index} className="p-4">
            <div className="grid grid-cols-12 gap-4">
              <div className="col-span-4">
                <GlassSelect
                  label="Item *"
                  options={itemOptions}
                  value={line.itemId}
                  onChange={(e) => updateLineItem(index, "itemId", e.target.value)}
                />
              </div>
              <div className="col-span-2">
                <GlassInput
                  label="Quantity *"
                  type="number"
                  value={line.quantity}
                  onChange={(e) => updateLineItem(index, "quantity", e.target.value)}
                  placeholder="0"
                />
              </div>
              <div className="col-span-3">
                <GlassSelect
                  label="Warehouse *"
                  options={warehouseOptions}
                  value={line.warehouseId}
                  onChange={(e) => updateLineItem(index, "warehouseId", e.target.value)}
                />
              </div>
              <div className="col-span-2">
                <GlassInput
                  label="Lot #"
                  value={line.lotNumber}
                  onChange={(e) => updateLineItem(index, "lotNumber", e.target.value)}
                  placeholder="LOT-001"
                />
              </div>
              <div className="col-span-1 flex items-end">
                {lineItems.length > 1 && (
                  <GlassButton
                    onClick={() => removeLineItem(index)}
                    variant="ghost"
                    size="sm"
                    className="text-red-400 hover:text-red-300"
                  >
                    <Trash2 className="w-4 h-4" />
                  </GlassButton>
                )}
              </div>
            </div>
          </GlassCard>
        ))}
      </div>

      {/* Notes */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Notes</h3>
        <GlassTextarea
          value={formData.notes}
          onChange={(e) => updateField("notes", e.target.value)}
          rows={2}
          placeholder="Additional notes about this receipt..."
        />
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-6 border-t border-white/10">
        <GlassButton onClick={onBack} variant="ghost">
          Cancel
        </GlassButton>
        <GlassButton onClick={handleSubmit} variant="primary" disabled={isSubmitting}>
          {isSubmitting ? "Processing..." : "Receive Stock"}
        </GlassButton>
      </div>
    </div>
  );
}
