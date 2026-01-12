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
import { ArrowLeft, Info, Plus, Trash2, ArrowRight } from "lucide-react";

interface TransferStockFormProps {
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
  fromWarehouseId: string;
  toWarehouseId: string;
  notes: string;
}

export default function TransferStockForm({ onBack, onSuccess }: TransferStockFormProps) {
  const { addToast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);

  const [formData, setFormData] = useState({
    transferDate: new Date().toISOString().split("T")[0],
    reference: "",
    reason: "rebalancing",
    notes: "",
  });

  const [lineItems, setLineItems] = useState<LineItem[]>([
    { itemId: "", itemName: "", quantity: "", fromWarehouseId: "", toWarehouseId: "", notes: "" },
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
      { itemId: "", itemName: "", quantity: "", fromWarehouseId: "", toWarehouseId: "", notes: "" },
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

      const validLines = lineItems.filter(
        (line) => line.itemId && line.quantity && line.fromWarehouseId && line.toWarehouseId
      );

      if (validLines.length === 0) {
        addToast("error", "At least one complete line item is required");
        return;
      }

      // Validate that from and to warehouses are different
      for (const line of validLines) {
        if (line.fromWarehouseId === line.toWarehouseId) {
          addToast("error", "Source and destination warehouses must be different");
          return;
        }
      }

      const res = await fetch("/api/operations/inventory-transfers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transferDate: formData.transferDate,
          reference: formData.reference || null,
          reason: formData.reason,
          notes: formData.notes || null,
          lines: validLines.map((line) => ({
            itemId: line.itemId,
            quantity: parseFloat(line.quantity),
            fromWarehouseId: line.fromWarehouseId,
            toWarehouseId: line.toWarehouseId,
            notes: line.notes || null,
          })),
        }),
      });

      if (res.ok) {
        onSuccess();
      } else {
        const error = await res.json();
        addToast("error", error.message || "Failed to transfer stock");
      }
    } catch (error) {
      console.error("Error transferring stock:", error);
      addToast("error", "Failed to transfer stock");
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

  const reasonOptions = [
    { value: "rebalancing", label: "Stock Rebalancing" },
    { value: "fulfillment", label: "Order Fulfillment" },
    { value: "consolidation", label: "Consolidation" },
    { value: "relocation", label: "Warehouse Relocation" },
    { value: "other", label: "Other" },
  ];

  return (
    <div className="space-y-6">
      <GlassButton onClick={onBack} variant="ghost" size="sm">
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to menu
      </GlassButton>

      {/* Transfer Info */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold flex items-center">
          Transfer Information
          <InfoTooltip text="Basic details about this stock transfer" />
        </h3>

        <div className="grid grid-cols-3 gap-4">
          <GlassInput
            label="Transfer Date *"
            type="date"
            value={formData.transferDate}
            onChange={(e) => updateField("transferDate", e.target.value)}
          />
          <GlassInput
            label="Reference #"
            value={formData.reference}
            onChange={(e) => updateField("reference", e.target.value)}
            placeholder="TRF-001"
          />
          <GlassSelect
            label="Reason"
            options={reasonOptions}
            value={formData.reason}
            onChange={(e) => updateField("reason", e.target.value)}
          />
        </div>
      </div>

      {/* Line Items */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold flex items-center">
            Items to Transfer
            <InfoTooltip text="Add items and specify source and destination warehouses" />
          </h3>
          <GlassButton onClick={addLineItem} variant="ghost" size="sm">
            <Plus className="w-4 h-4 mr-2" />
            Add Item
          </GlassButton>
        </div>

        {lineItems.map((line, index) => (
          <GlassCard key={index} className="p-4">
            <div className="grid grid-cols-12 gap-4 items-end">
              <div className="col-span-3">
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
                  label="From Warehouse *"
                  options={warehouseOptions}
                  value={line.fromWarehouseId}
                  onChange={(e) => updateLineItem(index, "fromWarehouseId", e.target.value)}
                />
              </div>
              <div className="col-span-1 flex justify-center pb-2">
                <ArrowRight className="w-5 h-5 text-white/40" />
              </div>
              <div className="col-span-2">
                <GlassSelect
                  label="To Warehouse *"
                  options={warehouseOptions}
                  value={line.toWarehouseId}
                  onChange={(e) => updateLineItem(index, "toWarehouseId", e.target.value)}
                />
              </div>
              <div className="col-span-1 flex justify-end">
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
          placeholder="Additional notes about this transfer..."
        />
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-6 border-t border-white/10">
        <GlassButton onClick={onBack} variant="ghost">
          Cancel
        </GlassButton>
        <GlassButton onClick={handleSubmit} variant="primary" disabled={isSubmitting}>
          {isSubmitting ? "Processing..." : "Transfer Stock"}
        </GlassButton>
      </div>
    </div>
  );
}
