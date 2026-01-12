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

interface AddServiceFormProps {
  onBack: () => void;
  onSuccess: () => void;
}

export default function AddServiceForm({ onBack, onSuccess }: AddServiceFormProps) {
  const { addToast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    serviceCode: "",
    description: "",
    category: "",
    serviceType: "consulting",
    hourlyRate: "",
    dailyRate: "",
    fixedPrice: "",
    estimatedDuration: "",
    serviceLevel: "standard",
    isBillable: true,
    requiresApproval: false,
  });

  const updateField = (field: string, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    try {
      setIsSubmitting(true);

      if (!formData.name) {
        addToast("error", "Service name is required");
        return;
      }

      if (!formData.serviceCode) {
        addToast("error", "Service code is required");
        return;
      }

      const res = await fetch("/api/master/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "service",
          name: formData.name,
          sku: formData.serviceCode,
          description: formData.description,
          category: formData.category,
          defaultSalesPrice: formData.hourlyRate || formData.dailyRate || formData.fixedPrice || null,
          trackInventory: false,
          status: "active",
          metadata: {
            serviceType: formData.serviceType,
            hourlyRate: formData.hourlyRate || null,
            dailyRate: formData.dailyRate || null,
            fixedPrice: formData.fixedPrice || null,
            estimatedDuration: formData.estimatedDuration || null,
            serviceLevel: formData.serviceLevel,
            isBillable: formData.isBillable,
            requiresApproval: formData.requiresApproval,
          },
        }),
      });

      if (res.ok) {
        onSuccess();
      } else {
        const error = await res.json();
        addToast("error", error.message || "Failed to create service");
      }
    } catch (error) {
      console.error("Error creating service:", error);
      addToast("error", "Failed to create service");
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

  const serviceTypeOptions = [
    { value: "consulting", label: "Consulting" },
    { value: "maintenance", label: "Maintenance" },
    { value: "installation", label: "Installation" },
    { value: "training", label: "Training" },
    { value: "support", label: "Support" },
    { value: "other", label: "Other" },
  ];

  const serviceLevelOptions = [
    { value: "standard", label: "Standard" },
    { value: "premium", label: "Premium" },
    { value: "enterprise", label: "Enterprise" },
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
          <InfoTooltip text="Required fields for creating the service" />
        </h3>

        <div className="grid grid-cols-2 gap-4">
          <GlassInput
            label="Service Name *"
            value={formData.name}
            onChange={(e) => updateField("name", e.target.value)}
            placeholder="Enter service name"
          />
          <GlassInput
            label="Service Code *"
            value={formData.serviceCode}
            onChange={(e) => updateField("serviceCode", e.target.value)}
            placeholder="e.g., SVC-001"
          />
        </div>

        <GlassTextarea
          label="Description"
          value={formData.description}
          onChange={(e) => updateField("description", e.target.value)}
          rows={3}
          placeholder="Service description..."
        />

        <div className="grid grid-cols-2 gap-4">
          <GlassInput
            label="Category"
            value={formData.category}
            onChange={(e) => updateField("category", e.target.value)}
            placeholder="e.g., IT Services, Consulting"
          />
          <GlassSelect
            label="Service Type"
            options={serviceTypeOptions}
            value={formData.serviceType}
            onChange={(e) => updateField("serviceType", e.target.value)}
          />
        </div>
      </div>

      {/* Pricing */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold flex items-center">
          Pricing
          <InfoTooltip text="Set one or more pricing options" />
        </h3>

        <div className="grid grid-cols-3 gap-4">
          <GlassInput
            label="Hourly Rate"
            type="number"
            value={formData.hourlyRate}
            onChange={(e) => updateField("hourlyRate", e.target.value)}
            placeholder="0.00"
          />
          <GlassInput
            label="Daily Rate"
            type="number"
            value={formData.dailyRate}
            onChange={(e) => updateField("dailyRate", e.target.value)}
            placeholder="0.00"
          />
          <GlassInput
            label="Fixed Price"
            type="number"
            value={formData.fixedPrice}
            onChange={(e) => updateField("fixedPrice", e.target.value)}
            placeholder="0.00"
          />
        </div>
      </div>

      {/* Service Details */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold flex items-center">
          Service Details
          <InfoTooltip text="Additional configuration for the service" />
        </h3>

        <div className="grid grid-cols-2 gap-4">
          <GlassInput
            label="Estimated Duration (hours)"
            type="number"
            value={formData.estimatedDuration}
            onChange={(e) => updateField("estimatedDuration", e.target.value)}
            placeholder="0"
          />
          <GlassSelect
            label="Service Level"
            options={serviceLevelOptions}
            value={formData.serviceLevel}
            onChange={(e) => updateField("serviceLevel", e.target.value)}
          />
        </div>

        <div className="flex gap-6">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.isBillable}
              onChange={(e) => updateField("isBillable", e.target.checked)}
              className="w-4 h-4 rounded border-white/20 bg-white/5 text-blue-500 focus:ring-blue-500"
            />
            <span className="text-sm text-white/80">Billable</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.requiresApproval}
              onChange={(e) => updateField("requiresApproval", e.target.checked)}
              className="w-4 h-4 rounded border-white/20 bg-white/5 text-blue-500 focus:ring-blue-500"
            />
            <span className="text-sm text-white/80">Requires Approval</span>
          </label>
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-6 border-t border-white/10">
        <GlassButton onClick={onBack} variant="ghost">
          Cancel
        </GlassButton>
        <GlassButton onClick={handleSubmit} variant="primary" disabled={isSubmitting}>
          {isSubmitting ? "Creating..." : "Create Service"}
        </GlassButton>
      </div>
    </div>
  );
}
