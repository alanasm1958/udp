"use client";

import { useState } from "react";
import {
  GlassInput,
  GlassSelect,
  GlassTextarea,
  GlassButton,
  useToast,
} from "@/components/ui/glass";
import { ArrowLeft, Info } from "lucide-react";

interface AddOfficeFormProps {
  onBack: () => void;
  onSuccess: () => void;
}

export default function AddOfficeForm({ onBack, onSuccess }: AddOfficeFormProps) {
  const { addToast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    code: "",
    name: "",
    type: "physical",
    address: "",
    city: "",
    state: "",
    postalCode: "",
    country: "",
    capacity: "",
    monthlyCost: "",
    currency: "USD",
    leaseStartDate: "",
    leaseEndDate: "",
  });

  const updateField = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    try {
      setIsSubmitting(true);

      if (!formData.code) {
        addToast("error", "Office code is required");
        return;
      }

      if (!formData.name) {
        addToast("error", "Office name is required");
        return;
      }

      const res = await fetch("/api/operations/offices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: formData.code,
          name: formData.name,
          type: formData.type,
          address: formData.address || null,
          city: formData.city || null,
          state: formData.state || null,
          postalCode: formData.postalCode || null,
          country: formData.country || null,
          capacity: formData.capacity ? parseInt(formData.capacity) : null,
          monthlyCost: formData.monthlyCost || null,
          currency: formData.currency,
          leaseStartDate: formData.leaseStartDate || null,
          leaseEndDate: formData.leaseEndDate || null,
        }),
      });

      if (res.ok) {
        onSuccess();
      } else {
        const error = await res.json();
        addToast("error", error.error || "Failed to create office");
      }
    } catch (error) {
      console.error("Error creating office:", error);
      addToast("error", "Failed to create office");
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

  const officeTypeOptions = [
    { value: "physical", label: "Physical" },
    { value: "virtual", label: "Virtual" },
    { value: "hybrid", label: "Hybrid" },
  ];

  const currencyOptions = [
    { value: "USD", label: "USD" },
    { value: "EUR", label: "EUR" },
    { value: "GBP", label: "GBP" },
    { value: "CAD", label: "CAD" },
    { value: "AUD", label: "AUD" },
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
          <InfoTooltip text="Required fields for creating the office" />
        </h3>

        <div className="grid grid-cols-3 gap-4">
          <GlassInput
            label="Office Code *"
            value={formData.code}
            onChange={(e) => updateField("code", e.target.value)}
            placeholder="e.g., HQ, NYC-01"
          />
          <GlassInput
            label="Office Name *"
            value={formData.name}
            onChange={(e) => updateField("name", e.target.value)}
            placeholder="Enter office name"
          />
          <GlassSelect
            label="Office Type"
            options={officeTypeOptions}
            value={formData.type}
            onChange={(e) => updateField("type", e.target.value)}
          />
        </div>
      </div>

      {/* Address */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold flex items-center">
          Address
          <InfoTooltip text="Physical location of the office (if applicable)" />
        </h3>

        <GlassInput
          label="Street Address"
          value={formData.address}
          onChange={(e) => updateField("address", e.target.value)}
          placeholder="123 Main Street, Suite 100"
        />

        <div className="grid grid-cols-4 gap-4">
          <GlassInput
            label="City"
            value={formData.city}
            onChange={(e) => updateField("city", e.target.value)}
            placeholder="City"
          />
          <GlassInput
            label="State/Province"
            value={formData.state}
            onChange={(e) => updateField("state", e.target.value)}
            placeholder="State"
          />
          <GlassInput
            label="Postal Code"
            value={formData.postalCode}
            onChange={(e) => updateField("postalCode", e.target.value)}
            placeholder="12345"
          />
          <GlassInput
            label="Country"
            value={formData.country}
            onChange={(e) => updateField("country", e.target.value)}
            placeholder="Country"
          />
        </div>
      </div>

      {/* Capacity & Cost */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold flex items-center">
          Capacity & Cost
          <InfoTooltip text="Office capacity and monthly expenses" />
        </h3>

        <div className="grid grid-cols-3 gap-4">
          <GlassInput
            label="Capacity (seats)"
            type="number"
            value={formData.capacity}
            onChange={(e) => updateField("capacity", e.target.value)}
            placeholder="Number of seats/desks"
          />
          <GlassInput
            label="Monthly Cost"
            type="number"
            value={formData.monthlyCost}
            onChange={(e) => updateField("monthlyCost", e.target.value)}
            placeholder="0.00"
          />
          <GlassSelect
            label="Currency"
            options={currencyOptions}
            value={formData.currency}
            onChange={(e) => updateField("currency", e.target.value)}
          />
        </div>
      </div>

      {/* Lease Info */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold flex items-center">
          Lease Information
          <InfoTooltip text="Lease period for the office space" />
        </h3>

        <div className="grid grid-cols-2 gap-4">
          <GlassInput
            label="Lease Start Date"
            type="date"
            value={formData.leaseStartDate}
            onChange={(e) => updateField("leaseStartDate", e.target.value)}
          />
          <GlassInput
            label="Lease End Date"
            type="date"
            value={formData.leaseEndDate}
            onChange={(e) => updateField("leaseEndDate", e.target.value)}
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-6 border-t border-white/10">
        <GlassButton onClick={onBack} variant="ghost">
          Cancel
        </GlassButton>
        <GlassButton onClick={handleSubmit} variant="primary" disabled={isSubmitting}>
          {isSubmitting ? "Creating..." : "Create Office"}
        </GlassButton>
      </div>
    </div>
  );
}
