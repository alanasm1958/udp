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

interface AddVendorFormProps {
  onBack: () => void;
  onSuccess: () => void;
}

export default function AddVendorForm({ onBack, onSuccess }: AddVendorFormProps) {
  const { addToast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    vendorCode: "",
    legalName: "",
    tradingName: "",
    vendorType: "supplier",
    primaryContactName: "",
    email: "",
    phone: "",
    alternativePhone: "",
    website: "",
    streetAddress: "",
    city: "",
    stateProvince: "",
    postalCode: "",
    country: "",
    currency: "USD",
    paymentTerms: "net_30",
    creditLimit: "",
    taxId: "",
    notes: "",
  });

  const updateField = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    try {
      setIsSubmitting(true);

      if (!formData.legalName) {
        addToast("error", "Legal name is required");
        return;
      }

      if (!formData.email) {
        addToast("error", "Email is required");
        return;
      }

      const res = await fetch("/api/master/parties", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "vendor",
          code: formData.vendorCode || null,
          name: formData.legalName,
          email: formData.email,
          phone: formData.phone || null,
          address: formData.streetAddress || null,
          city: formData.city || null,
          state: formData.stateProvince || null,
          postalCode: formData.postalCode || null,
          country: formData.country || null,
          taxId: formData.taxId || null,
          defaultCurrency: formData.currency,
          notes: formData.notes || null,
          metadata: {
            tradingName: formData.tradingName || null,
            vendorType: formData.vendorType,
            primaryContactName: formData.primaryContactName || null,
            alternativePhone: formData.alternativePhone || null,
            website: formData.website || null,
            paymentTerms: formData.paymentTerms,
            creditLimit: formData.creditLimit ? parseFloat(formData.creditLimit) : null,
          },
        }),
      });

      if (res.ok) {
        onSuccess();
      } else {
        const error = await res.json();
        addToast("error", error.message || "Failed to create vendor");
      }
    } catch (error) {
      console.error("Error creating vendor:", error);
      addToast("error", "Failed to create vendor");
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

  const vendorTypeOptions = [
    { value: "supplier", label: "Supplier" },
    { value: "service_provider", label: "Service Provider" },
    { value: "both", label: "Both" },
  ];

  const paymentTermsOptions = [
    { value: "due_on_receipt", label: "Due on Receipt" },
    { value: "net_15", label: "Net 15" },
    { value: "net_30", label: "Net 30" },
    { value: "net_45", label: "Net 45" },
    { value: "net_60", label: "Net 60" },
    { value: "net_90", label: "Net 90" },
  ];

  const currencyOptions = [
    { value: "USD", label: "USD - US Dollar" },
    { value: "EUR", label: "EUR - Euro" },
    { value: "GBP", label: "GBP - British Pound" },
    { value: "CAD", label: "CAD - Canadian Dollar" },
    { value: "AUD", label: "AUD - Australian Dollar" },
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
          <InfoTooltip text="Required fields for creating the vendor" />
        </h3>

        <div className="grid grid-cols-2 gap-4">
          <GlassInput
            label="Vendor Code"
            value={formData.vendorCode}
            onChange={(e) => updateField("vendorCode", e.target.value)}
            placeholder="Auto-generated if empty"
          />
          <GlassSelect
            label="Vendor Type *"
            options={vendorTypeOptions}
            value={formData.vendorType}
            onChange={(e) => updateField("vendorType", e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <GlassInput
            label="Legal Name *"
            value={formData.legalName}
            onChange={(e) => updateField("legalName", e.target.value)}
            placeholder="Company legal name"
          />
          <GlassInput
            label="Trading Name"
            value={formData.tradingName}
            onChange={(e) => updateField("tradingName", e.target.value)}
            placeholder="DBA or trading name"
          />
        </div>
      </div>

      {/* Contact */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold flex items-center">
          Contact Information
          <InfoTooltip text="Primary contact details" />
        </h3>

        <div className="grid grid-cols-2 gap-4">
          <GlassInput
            label="Primary Contact Name"
            value={formData.primaryContactName}
            onChange={(e) => updateField("primaryContactName", e.target.value)}
            placeholder="Contact person name"
          />
          <GlassInput
            label="Email *"
            type="email"
            value={formData.email}
            onChange={(e) => updateField("email", e.target.value)}
            placeholder="email@company.com"
          />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <GlassInput
            label="Phone"
            type="tel"
            value={formData.phone}
            onChange={(e) => updateField("phone", e.target.value)}
            placeholder="+1 (555) 123-4567"
          />
          <GlassInput
            label="Alternative Phone"
            type="tel"
            value={formData.alternativePhone}
            onChange={(e) => updateField("alternativePhone", e.target.value)}
            placeholder="+1 (555) 987-6543"
          />
          <GlassInput
            label="Website"
            type="url"
            value={formData.website}
            onChange={(e) => updateField("website", e.target.value)}
            placeholder="https://www.company.com"
          />
        </div>
      </div>

      {/* Address */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold flex items-center">
          Address
          <InfoTooltip text="Vendor physical address" />
        </h3>

        <GlassInput
          label="Street Address"
          value={formData.streetAddress}
          onChange={(e) => updateField("streetAddress", e.target.value)}
          placeholder="123 Main Street"
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
            value={formData.stateProvince}
            onChange={(e) => updateField("stateProvince", e.target.value)}
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

      {/* Financial */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold flex items-center">
          Financial
          <InfoTooltip text="Payment terms and financial details" />
        </h3>

        <div className="grid grid-cols-3 gap-4">
          <GlassSelect
            label="Currency"
            options={currencyOptions}
            value={formData.currency}
            onChange={(e) => updateField("currency", e.target.value)}
          />
          <GlassSelect
            label="Payment Terms"
            options={paymentTermsOptions}
            value={formData.paymentTerms}
            onChange={(e) => updateField("paymentTerms", e.target.value)}
          />
          <GlassInput
            label="Credit Limit"
            type="number"
            value={formData.creditLimit}
            onChange={(e) => updateField("creditLimit", e.target.value)}
            placeholder="0.00"
          />
        </div>

        <GlassInput
          label="Tax ID / VAT Number"
          value={formData.taxId}
          onChange={(e) => updateField("taxId", e.target.value)}
          placeholder="Tax identification number"
        />
      </div>

      {/* Notes */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Notes</h3>
        <GlassTextarea
          value={formData.notes}
          onChange={(e) => updateField("notes", e.target.value)}
          rows={3}
          placeholder="Internal notes about this vendor..."
        />
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-6 border-t border-white/10">
        <GlassButton onClick={onBack} variant="ghost">
          Cancel
        </GlassButton>
        <GlassButton onClick={handleSubmit} variant="primary" disabled={isSubmitting}>
          {isSubmitting ? "Creating..." : "Create Vendor"}
        </GlassButton>
      </div>
    </div>
  );
}
