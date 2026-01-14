"use client";

import { useState, useEffect } from "react";
import {
  GlassInput,
  GlassSelect,
  GlassTextarea,
  GlassButton,
  useToast,
} from "@/components/ui/glass";
import { ArrowLeft, Info } from "lucide-react";

interface AddAssetFormProps {
  onBack: () => void;
  onSuccess: () => void;
}

interface Warehouse {
  id: string;
  name: string;
}

interface Office {
  id: string;
  name: string;
}

interface Vendor {
  id: string;
  name: string;
}

export default function AddAssetForm({ onBack, onSuccess }: AddAssetFormProps) {
  const { addToast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [offices, setOffices] = useState<Office[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);

  const [formData, setFormData] = useState({
    assetTag: "",
    name: "",
    description: "",
    assetType: "equipment",
    category: "",
    purchaseDate: new Date().toISOString().split("T")[0],
    purchaseCost: "",
    vendorId: "",
    invoiceNumber: "",
    warrantyMonths: "",
    depreciationMethod: "straight_line",
    usefulLifeYears: "",
    salvageValue: "",
    locationType: "warehouse",
    locationId: "",
    serialNumber: "",
    modelNumber: "",
    manufacturer: "",
    requiresMaintenance: false,
    maintenanceFrequency: "",
  });

  useEffect(() => {
    loadWarehouses();
    loadOffices();
    loadVendors();
  }, []);

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

  const loadOffices = async () => {
    try {
      const res = await fetch("/api/operations/offices?status=active");
      if (res.ok) {
        const data = await res.json();
        setOffices(data.offices || []);
      }
    } catch (error) {
      console.error("Error loading offices:", error);
    }
  };

  const loadVendors = async () => {
    try {
      const res = await fetch("/api/master/parties?type=vendor");
      if (res.ok) {
        const data = await res.json();
        // Map API response fields to expected format
        setVendors((data.items || []).map((p: { id: string; displayName: string }) => ({
          id: p.id,
          name: p.displayName,
        })));
      }
    } catch (error) {
      console.error("Error loading vendors:", error);
    }
  };

  const updateField = (field: string, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    try {
      setIsSubmitting(true);

      if (!formData.name) {
        addToast("error", "Asset name is required");
        return;
      }

      if (!formData.assetTag) {
        addToast("error", "Asset tag is required");
        return;
      }

      if (!formData.purchaseCost) {
        addToast("error", "Purchase cost is required");
        return;
      }

      const res = await fetch("/api/master/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "asset",
          name: formData.name,
          sku: formData.assetTag,
          description: formData.description,
          category: formData.category,
          defaultPurchaseCost: formData.purchaseCost,
          trackInventory: false,
          defaultVendorId: formData.vendorId || null,
          status: "active",
          metadata: {
            assetType: formData.assetType,
            purchaseDate: formData.purchaseDate,
            invoiceNumber: formData.invoiceNumber,
            warrantyMonths: formData.warrantyMonths ? parseInt(formData.warrantyMonths) : null,
            depreciationMethod: formData.depreciationMethod,
            usefulLifeYears: formData.usefulLifeYears ? parseInt(formData.usefulLifeYears) : null,
            salvageValue: formData.salvageValue || null,
            locationType: formData.locationType,
            locationId: formData.locationId || null,
            serialNumber: formData.serialNumber || null,
            modelNumber: formData.modelNumber || null,
            manufacturer: formData.manufacturer || null,
            requiresMaintenance: formData.requiresMaintenance,
            maintenanceFrequency: formData.maintenanceFrequency || null,
          },
        }),
      });

      if (res.ok) {
        onSuccess();
      } else {
        const error = await res.json();
        addToast("error", error.message || "Failed to create asset");
      }
    } catch (error) {
      console.error("Error creating asset:", error);
      addToast("error", "Failed to create asset");
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

  const assetTypeOptions = [
    { value: "equipment", label: "Equipment" },
    { value: "furniture", label: "Furniture" },
    { value: "vehicle", label: "Vehicle" },
    { value: "it_equipment", label: "IT Equipment" },
    { value: "other", label: "Other" },
  ];

  const depreciationOptions = [
    { value: "straight_line", label: "Straight Line" },
    { value: "declining_balance", label: "Declining Balance" },
    { value: "none", label: "No Depreciation" },
  ];

  const locationTypeOptions = [
    { value: "warehouse", label: "Warehouse" },
    { value: "office", label: "Office" },
  ];

  const maintenanceFrequencyOptions = [
    { value: "", label: "Select frequency..." },
    { value: "monthly", label: "Monthly" },
    { value: "quarterly", label: "Quarterly" },
    { value: "semi_annual", label: "Semi-Annual" },
    { value: "annual", label: "Annual" },
  ];

  const locationOptions =
    formData.locationType === "warehouse"
      ? [{ value: "", label: "Select warehouse..." }, ...warehouses.map((w) => ({ value: w.id, label: w.name }))]
      : [{ value: "", label: "Select office..." }, ...offices.map((o) => ({ value: o.id, label: o.name }))];

  const vendorOptions = [
    { value: "", label: "Select vendor..." },
    ...vendors.map((v) => ({ value: v.id, label: v.name })),
  ];

  return (
    <div className="space-y-6">
      <GlassButton onClick={onBack} variant="ghost" size="sm">
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to menu
      </GlassButton>

      {/* Basic Info */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold flex items-center">
          Basic Information
          <InfoTooltip text="Required fields for creating the asset" />
        </h3>

        <div className="grid grid-cols-2 gap-4">
          <GlassInput
            label="Asset Tag *"
            value={formData.assetTag}
            onChange={(e) => updateField("assetTag", e.target.value)}
            placeholder="e.g., AST-001"
          />
          <GlassInput
            label="Name *"
            value={formData.name}
            onChange={(e) => updateField("name", e.target.value)}
            placeholder="Enter asset name"
          />
        </div>

        <GlassTextarea
          label="Description"
          value={formData.description}
          onChange={(e) => updateField("description", e.target.value)}
          rows={2}
          placeholder="Asset description..."
        />

        <div className="grid grid-cols-2 gap-4">
          <GlassSelect
            label="Asset Type *"
            options={assetTypeOptions}
            value={formData.assetType}
            onChange={(e) => updateField("assetType", e.target.value)}
          />
          <GlassInput
            label="Category"
            value={formData.category}
            onChange={(e) => updateField("category", e.target.value)}
            placeholder="e.g., Office Equipment"
          />
        </div>
      </div>

      {/* Purchase Details */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold flex items-center">
          Purchase Details
          <InfoTooltip text="Purchase and vendor information" />
        </h3>

        <div className="grid grid-cols-3 gap-4">
          <GlassInput
            label="Purchase Date *"
            type="date"
            value={formData.purchaseDate}
            onChange={(e) => updateField("purchaseDate", e.target.value)}
          />
          <GlassInput
            label="Purchase Cost *"
            type="number"
            value={formData.purchaseCost}
            onChange={(e) => updateField("purchaseCost", e.target.value)}
            placeholder="0.00"
          />
          <GlassInput
            label="Warranty (months)"
            type="number"
            value={formData.warrantyMonths}
            onChange={(e) => updateField("warrantyMonths", e.target.value)}
            placeholder="12"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <GlassSelect
            label="Vendor"
            options={vendorOptions}
            value={formData.vendorId}
            onChange={(e) => updateField("vendorId", e.target.value)}
          />
          <GlassInput
            label="Invoice Number"
            value={formData.invoiceNumber}
            onChange={(e) => updateField("invoiceNumber", e.target.value)}
            placeholder="INV-12345"
          />
        </div>
      </div>

      {/* Depreciation */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold flex items-center">
          Depreciation
          <InfoTooltip text="Asset depreciation settings" />
        </h3>

        <div className="grid grid-cols-3 gap-4">
          <GlassSelect
            label="Depreciation Method"
            options={depreciationOptions}
            value={formData.depreciationMethod}
            onChange={(e) => updateField("depreciationMethod", e.target.value)}
          />
          <GlassInput
            label="Useful Life (years)"
            type="number"
            value={formData.usefulLifeYears}
            onChange={(e) => updateField("usefulLifeYears", e.target.value)}
            placeholder="5"
          />
          <GlassInput
            label="Salvage Value"
            type="number"
            value={formData.salvageValue}
            onChange={(e) => updateField("salvageValue", e.target.value)}
            placeholder="0.00"
          />
        </div>
      </div>

      {/* Location */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold flex items-center">
          Location
          <InfoTooltip text="Where the asset is located" />
        </h3>

        <div className="grid grid-cols-2 gap-4">
          <GlassSelect
            label="Location Type"
            options={locationTypeOptions}
            value={formData.locationType}
            onChange={(e) => {
              updateField("locationType", e.target.value);
              updateField("locationId", "");
            }}
          />
          <GlassSelect
            label="Location"
            options={locationOptions}
            value={formData.locationId}
            onChange={(e) => updateField("locationId", e.target.value)}
          />
        </div>
      </div>

      {/* Additional Info */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold flex items-center">
          Additional Information
          <InfoTooltip text="Serial numbers and manufacturer details" />
        </h3>

        <div className="grid grid-cols-3 gap-4">
          <GlassInput
            label="Serial Number"
            value={formData.serialNumber}
            onChange={(e) => updateField("serialNumber", e.target.value)}
            placeholder="S/N"
          />
          <GlassInput
            label="Model Number"
            value={formData.modelNumber}
            onChange={(e) => updateField("modelNumber", e.target.value)}
            placeholder="Model"
          />
          <GlassInput
            label="Manufacturer"
            value={formData.manufacturer}
            onChange={(e) => updateField("manufacturer", e.target.value)}
            placeholder="Brand"
          />
        </div>

        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.requiresMaintenance}
              onChange={(e) => updateField("requiresMaintenance", e.target.checked)}
              className="w-4 h-4 rounded border-white/20 bg-white/5 text-blue-500 focus:ring-blue-500"
            />
            <span className="text-sm text-white/80">Requires Regular Maintenance</span>
          </label>
          {formData.requiresMaintenance && (
            <GlassSelect
              options={maintenanceFrequencyOptions}
              value={formData.maintenanceFrequency}
              onChange={(e) => updateField("maintenanceFrequency", e.target.value)}
            />
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-6 border-t border-white/10">
        <GlassButton onClick={onBack} variant="ghost">
          Cancel
        </GlassButton>
        <GlassButton onClick={handleSubmit} variant="primary" disabled={isSubmitting}>
          {isSubmitting ? "Creating..." : "Create Asset"}
        </GlassButton>
      </div>
    </div>
  );
}
