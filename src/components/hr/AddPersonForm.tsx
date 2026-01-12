"use client";

import { useState } from "react";
import {
  GlassInput,
  GlassSelect,
  GlassTextarea,
  GlassButton,
  useToast,
} from "@/components/ui/glass";
import { Info, ArrowLeft } from "lucide-react";

interface AddPersonFormProps {
  onBack: () => void;
  onSuccess: () => void;
}

export default function AddPersonForm({ onBack, onSuccess }: AddPersonFormProps) {
  const { addToast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    // Basic Information
    full_name: "",
    preferred_name: "",
    email: "",
    phone: "",

    // Employment Details
    employment_type: "staff",
    job_title: "",
    department: "",
    manager_id: "",
    hire_date: "",
    end_date: "",

    // Personal Details
    date_of_birth: "",
    nationality: "",
    gender: "",

    // Address
    address_line_1: "",
    address_line_2: "",
    city: "",
    region: "",
    country: "",
    postal_code: "",

    // Emergency Contact
    emergency_contact_name: "",
    emergency_contact_phone: "",
    emergency_contact_relationship: "",

    // Banking (for payroll)
    bank_name: "",
    bank_account_number: "",
    bank_routing_number: "",

    // Tax & Legal
    tax_id: "",
    social_security_number: "",
    work_permit_number: "",
    work_permit_expiry: "",

    // Compensation
    gross_salary: "",
    pay_frequency: "monthly",
    currency: "USD",

    // Benefits & Deductions
    health_insurance: false,
    pension_contribution_percent: "",

    // Platform Access
    can_access_platform: false,
    platform_role: "",

    // Notes
    notes: "",
  });

  const updateField = (field: string, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    try {
      setIsSubmitting(true);

      // Validation
      if (!formData.full_name) {
        addToast("error", "Full name is required");
        return;
      }
      if (!formData.employment_type) {
        addToast("error", "Employment type is required");
        return;
      }
      if (!formData.hire_date) {
        addToast("error", "Hire date is required");
        return;
      }

      const res = await fetch("/api/hr-people/persons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        addToast("success", "Person added successfully");
        onSuccess();
      } else {
        const error = await res.json();
        addToast("error", error.message || "Failed to add person");
      }
    } catch (error) {
      console.error("Error adding person:", error);
      addToast("error", "Failed to add person");
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
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1">
            <div className="border-4 border-transparent border-t-gray-900" />
          </div>
        </div>
      </div>
    </div>
  );

  const employmentTypeOptions = [
    { value: "staff", label: "Staff (Full-time employee)" },
    { value: "intern", label: "Intern" },
    { value: "part_time", label: "Part-time" },
    { value: "contractor", label: "Contractor" },
    { value: "consultant", label: "Consultant" },
    { value: "other", label: "Other" },
  ];

  const genderOptions = [
    { value: "", label: "Prefer not to say" },
    { value: "male", label: "Male" },
    { value: "female", label: "Female" },
    { value: "other", label: "Other" },
  ];

  const payFrequencyOptions = [
    { value: "weekly", label: "Weekly" },
    { value: "biweekly", label: "Bi-weekly" },
    { value: "monthly", label: "Monthly" },
    { value: "annual", label: "Annual" },
  ];

  const platformRoleOptions = [
    { value: "", label: "Select role..." },
    { value: "viewer", label: "Viewer (View only)" },
    { value: "employee", label: "Employee (Basic access)" },
    { value: "manager", label: "Manager (Team management)" },
    { value: "hr", label: "HR (Full HR access)" },
    { value: "admin", label: "Admin (Full system access)" },
  ];

  return (
    <div className="space-y-8">
      {/* Back Button */}
      <GlassButton onClick={onBack} variant="ghost" size="sm">
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to menu
      </GlassButton>

      {/* Explanation for SME owners */}
      <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
        <p className="text-sm text-blue-200">
          <strong>What is this for?</strong> This form collects all the
          information you need when hiring someone. Fill in what you have now -
          you can always update it later. Required fields are marked with *.
        </p>
      </div>

      {/* Basic Information */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold flex items-center">
          Basic Information
          <InfoTooltip text="Essential details to identify and contact the person" />
        </h3>

        <GlassInput
          label="Full Name *"
          value={formData.full_name}
          onChange={(e) => updateField("full_name", e.target.value)}
          placeholder="John Smith"
        />

        <div className="flex items-center">
          <span className="block text-sm text-white/60 mb-2">
            Preferred Name
          </span>
          <InfoTooltip text="What they like to be called (e.g., 'Johnny' instead of 'John')" />
        </div>
        <GlassInput
          value={formData.preferred_name}
          onChange={(e) => updateField("preferred_name", e.target.value)}
          placeholder="Optional"
        />

        <div className="grid grid-cols-2 gap-4">
          <GlassInput
            label="Email"
            type="email"
            value={formData.email}
            onChange={(e) => updateField("email", e.target.value)}
            placeholder="john@example.com"
          />
          <GlassInput
            label="Phone"
            type="tel"
            value={formData.phone}
            onChange={(e) => updateField("phone", e.target.value)}
            placeholder="+1 234 567 8900"
          />
        </div>
      </div>

      {/* Employment Details */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold flex items-center">
          Employment Details
          <InfoTooltip text="Job-related information and who they report to" />
        </h3>

        <div className="flex items-center mb-2">
          <span className="block text-sm text-white/60">Employment Type *</span>
          <InfoTooltip text="Select the type of employment relationship" />
        </div>
        <GlassSelect
          options={employmentTypeOptions}
          value={formData.employment_type}
          onChange={(e) => updateField("employment_type", e.target.value)}
        />

        <div className="grid grid-cols-2 gap-4">
          <GlassInput
            label="Job Title"
            value={formData.job_title}
            onChange={(e) => updateField("job_title", e.target.value)}
            placeholder="Software Engineer"
          />
          <GlassInput
            label="Department"
            value={formData.department}
            onChange={(e) => updateField("department", e.target.value)}
            placeholder="Engineering"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="flex items-center mb-2">
              <span className="block text-sm text-white/60">Hire Date *</span>
              <InfoTooltip text="When they start/started working" />
            </div>
            <GlassInput
              type="date"
              value={formData.hire_date}
              onChange={(e) => updateField("hire_date", e.target.value)}
            />
          </div>
          <div>
            <div className="flex items-center mb-2">
              <span className="block text-sm text-white/60">End Date (if applicable)</span>
              <InfoTooltip text="For fixed-term contracts or known end dates" />
            </div>
            <GlassInput
              type="date"
              value={formData.end_date}
              onChange={(e) => updateField("end_date", e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Personal Details */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold flex items-center">
          Personal Details
          <InfoTooltip text="Optional information for HR records" />
        </h3>

        <div className="grid grid-cols-3 gap-4">
          <GlassInput
            label="Date of Birth"
            type="date"
            value={formData.date_of_birth}
            onChange={(e) => updateField("date_of_birth", e.target.value)}
          />
          <GlassInput
            label="Nationality"
            value={formData.nationality}
            onChange={(e) => updateField("nationality", e.target.value)}
            placeholder="US"
          />
          <GlassSelect
            label="Gender"
            options={genderOptions}
            value={formData.gender}
            onChange={(e) => updateField("gender", e.target.value)}
          />
        </div>
      </div>

      {/* Address */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold flex items-center">
          Address
          <InfoTooltip text="Where they live - needed for tax and legal purposes" />
        </h3>

        <GlassInput
          label="Address Line 1"
          value={formData.address_line_1}
          onChange={(e) => updateField("address_line_1", e.target.value)}
          placeholder="123 Main Street"
        />

        <GlassInput
          label="Address Line 2"
          value={formData.address_line_2}
          onChange={(e) => updateField("address_line_2", e.target.value)}
          placeholder="Apt 4B"
        />

        <div className="grid grid-cols-2 gap-4">
          <GlassInput
            label="City"
            value={formData.city}
            onChange={(e) => updateField("city", e.target.value)}
            placeholder="New York"
          />
          <GlassInput
            label="Region/State"
            value={formData.region}
            onChange={(e) => updateField("region", e.target.value)}
            placeholder="NY"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <GlassInput
            label="Country"
            value={formData.country}
            onChange={(e) => updateField("country", e.target.value)}
            placeholder="United States"
          />
          <GlassInput
            label="Postal Code"
            value={formData.postal_code}
            onChange={(e) => updateField("postal_code", e.target.value)}
            placeholder="10001"
          />
        </div>
      </div>

      {/* Emergency Contact */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold flex items-center">
          Emergency Contact
          <InfoTooltip text="Who to contact in case of emergency - very important!" />
        </h3>

        <GlassInput
          label="Name"
          value={formData.emergency_contact_name}
          onChange={(e) => updateField("emergency_contact_name", e.target.value)}
          placeholder="Jane Smith"
        />

        <div className="grid grid-cols-2 gap-4">
          <GlassInput
            label="Phone"
            type="tel"
            value={formData.emergency_contact_phone}
            onChange={(e) => updateField("emergency_contact_phone", e.target.value)}
            placeholder="+1 234 567 8900"
          />
          <GlassInput
            label="Relationship"
            value={formData.emergency_contact_relationship}
            onChange={(e) => updateField("emergency_contact_relationship", e.target.value)}
            placeholder="Spouse"
          />
        </div>
      </div>

      {/* Banking Details */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold flex items-center">
          Banking Details
          <InfoTooltip text="Needed to pay them - keep this information secure!" />
        </h3>

        <GlassInput
          label="Bank Name"
          value={formData.bank_name}
          onChange={(e) => updateField("bank_name", e.target.value)}
          placeholder="Chase Bank"
        />

        <div className="grid grid-cols-2 gap-4">
          <GlassInput
            label="Account Number"
            type="password"
            value={formData.bank_account_number}
            onChange={(e) => updateField("bank_account_number", e.target.value)}
            placeholder="1234567890"
          />
          <GlassInput
            label="Routing Number"
            value={formData.bank_routing_number}
            onChange={(e) => updateField("bank_routing_number", e.target.value)}
            placeholder="021000021"
          />
        </div>
      </div>

      {/* Tax & Legal */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold flex items-center">
          Tax & Legal Information
          <InfoTooltip text="Required for tax compliance and legal employment" />
        </h3>

        <div className="grid grid-cols-2 gap-4">
          <GlassInput
            label="Tax ID / National ID"
            type="password"
            value={formData.tax_id}
            onChange={(e) => updateField("tax_id", e.target.value)}
            placeholder="123-45-6789"
          />
          <GlassInput
            label="Social Security Number"
            type="password"
            value={formData.social_security_number}
            onChange={(e) => updateField("social_security_number", e.target.value)}
            placeholder="123-45-6789"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <GlassInput
            label="Work Permit Number (if applicable)"
            value={formData.work_permit_number}
            onChange={(e) => updateField("work_permit_number", e.target.value)}
            placeholder="WP123456"
          />
          <GlassInput
            label="Work Permit Expiry"
            type="date"
            value={formData.work_permit_expiry}
            onChange={(e) => updateField("work_permit_expiry", e.target.value)}
          />
        </div>
      </div>

      {/* Compensation */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold flex items-center">
          Compensation
          <InfoTooltip text="How much you'll pay them and how often" />
        </h3>

        <div className="grid grid-cols-3 gap-4">
          <GlassInput
            label="Gross Salary"
            type="number"
            value={formData.gross_salary}
            onChange={(e) => updateField("gross_salary", e.target.value)}
            placeholder="50000"
          />
          <GlassSelect
            label="Pay Frequency"
            options={payFrequencyOptions}
            value={formData.pay_frequency}
            onChange={(e) => updateField("pay_frequency", e.target.value)}
          />
          <GlassInput
            label="Currency"
            value={formData.currency}
            onChange={(e) => updateField("currency", e.target.value)}
            placeholder="USD"
          />
        </div>
      </div>

      {/* Benefits */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold flex items-center">
          Benefits & Deductions
          <InfoTooltip text="Additional benefits and automatic deductions" />
        </h3>

        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={formData.health_insurance}
            onChange={(e) => updateField("health_insurance", e.target.checked)}
            className="w-5 h-5 rounded bg-white/10 border-white/20 text-blue-500 focus:ring-blue-500/50"
          />
          <span className="text-sm">Enrolled in Health Insurance</span>
        </label>

        <div className="flex items-center mb-2">
          <span className="block text-sm text-white/60">Pension Contribution (%)</span>
          <InfoTooltip text="Percentage of salary for pension/retirement savings" />
        </div>
        <GlassInput
          type="number"
          value={formData.pension_contribution_percent}
          onChange={(e) => updateField("pension_contribution_percent", e.target.value)}
          placeholder="5"
        />
      </div>

      {/* Platform Access */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold flex items-center">
          Platform Access
          <InfoTooltip text="Give them access to this system as a subtenant" />
        </h3>

        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={formData.can_access_platform}
            onChange={(e) => updateField("can_access_platform", e.target.checked)}
            className="w-5 h-5 rounded bg-white/10 border-white/20 text-blue-500 focus:ring-blue-500/50"
          />
          <span className="text-sm">Create Platform Account (Subtenant)</span>
        </label>

        {formData.can_access_platform && (
          <>
            <div className="flex items-center mb-2">
              <span className="block text-sm text-white/60">Platform Role & Accessibility</span>
              <InfoTooltip text="What they can do in the system and what they can access" />
            </div>
            <GlassSelect
              options={platformRoleOptions}
              value={formData.platform_role}
              onChange={(e) => updateField("platform_role", e.target.value)}
            />
          </>
        )}
      </div>

      {/* Notes */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Additional Notes</h3>
        <GlassTextarea
          value={formData.notes}
          onChange={(e) => updateField("notes", e.target.value)}
          rows={4}
          placeholder="Any additional information..."
        />
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-6 border-t border-white/10">
        <GlassButton onClick={onBack} variant="ghost">
          Cancel
        </GlassButton>
        <GlassButton
          onClick={handleSubmit}
          variant="primary"
          disabled={isSubmitting}
        >
          {isSubmitting ? "Adding..." : "Add Person"}
        </GlassButton>
      </div>
    </div>
  );
}
