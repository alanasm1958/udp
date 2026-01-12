// components/hr/AddPersonForm.tsx
"use client";

import { useState } from "react";
import {
  GlassInput,
  GlassSelect,
  GlassTextArea,
  GlassButton,
  GlassCheckbox,
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

  const updateField = (field: string, value: any) => {
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

  return (
    <div className="p-6 space-y-8">
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

        <div>
          <label className="block text-sm text-white/60 mb-2">
            Full Name *
          </label>
          <GlassInput
            value={formData.full_name}
            onChange={(e) => updateField("full_name", e.target.value)}
            placeholder="John Smith"
          />
        </div>

        <div>
          <label className="block text-sm text-white/60 mb-2">
            Preferred Name
            <InfoTooltip text="What they like to be called (e.g., 'Johnny' instead of 'John')" />
          </label>
          <GlassInput
            value={formData.preferred_name}
            onChange={(e) => updateField("preferred_name", e.target.value)}
            placeholder="Optional"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-white/60 mb-2">Email</label>
            <GlassInput
              type="email"
              value={formData.email}
              onChange={(e) => updateField("email", e.target.value)}
              placeholder="john@example.com"
            />
          </div>
          <div>
            <label className="block text-sm text-white/60 mb-2">Phone</label>
            <GlassInput
              type="tel"
              value={formData.phone}
              onChange={(e) => updateField("phone", e.target.value)}
              placeholder="+1 234 567 8900"
            />
          </div>
        </div>
      </div>

      {/* Employment Details */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold flex items-center">
          Employment Details
          <InfoTooltip text="Job-related information and who they report to" />
        </h3>

        <div>
          <label className="block text-sm text-white/60 mb-2">
            Employment Type *
            <InfoTooltip text="Select the type of employment relationship" />
          </label>
          <GlassSelect
            value={formData.employment_type}
            onChange={(e) => updateField("employment_type", e.target.value)}
          >
            <option value="staff">Staff (Full-time employee)</option>
            <option value="intern">Intern</option>
            <option value="part_time">Part-time</option>
            <option value="contractor">Contractor</option>
            <option value="consultant">Consultant</option>
            <option value="other">Other</option>
          </GlassSelect>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-white/60 mb-2">
              Job Title
            </label>
            <GlassInput
              value={formData.job_title}
              onChange={(e) => updateField("job_title", e.target.value)}
              placeholder="Software Engineer"
            />
          </div>
          <div>
            <label className="block text-sm text-white/60 mb-2">
              Department
            </label>
            <GlassInput
              value={formData.department}
              onChange={(e) => updateField("department", e.target.value)}
              placeholder="Engineering"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-white/60 mb-2">
              Hire Date *
              <InfoTooltip text="When they start/started working" />
            </label>
            <GlassInput
              type="date"
              value={formData.hire_date}
              onChange={(e) => updateField("hire_date", e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm text-white/60 mb-2">
              End Date (if applicable)
              <InfoTooltip text="For fixed-term contracts or known end dates" />
            </label>
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
          <div>
            <label className="block text-sm text-white/60 mb-2">
              Date of Birth
            </label>
            <GlassInput
              type="date"
              value={formData.date_of_birth}
              onChange={(e) => updateField("date_of_birth", e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm text-white/60 mb-2">
              Nationality
            </label>
            <GlassInput
              value={formData.nationality}
              onChange={(e) => updateField("nationality", e.target.value)}
              placeholder="US"
            />
          </div>
          <div>
            <label className="block text-sm text-white/60 mb-2">Gender</label>
            <GlassSelect
              value={formData.gender}
              onChange={(e) => updateField("gender", e.target.value)}
            >
              <option value="">Prefer not to say</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </GlassSelect>
          </div>
        </div>
      </div>

      {/* Address */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold flex items-center">
          Address
          <InfoTooltip text="Where they live - needed for tax and legal purposes" />
        </h3>

        <div>
          <label className="block text-sm text-white/60 mb-2">
            Address Line 1
          </label>
          <GlassInput
            value={formData.address_line_1}
            onChange={(e) => updateField("address_line_1", e.target.value)}
            placeholder="123 Main Street"
          />
        </div>

        <div>
          <label className="block text-sm text-white/60 mb-2">
            Address Line 2
          </label>
          <GlassInput
            value={formData.address_line_2}
            onChange={(e) => updateField("address_line_2", e.target.value)}
            placeholder="Apt 4B"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-white/60 mb-2">City</label>
            <GlassInput
              value={formData.city}
              onChange={(e) => updateField("city", e.target.value)}
              placeholder="New York"
            />
          </div>
          <div>
            <label className="block text-sm text-white/60 mb-2">
              Region/State
            </label>
            <GlassInput
              value={formData.region}
              onChange={(e) => updateField("region", e.target.value)}
              placeholder="NY"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-white/60 mb-2">
              Country
            </label>
            <GlassInput
              value={formData.country}
              onChange={(e) => updateField("country", e.target.value)}
              placeholder="United States"
            />
          </div>
          <div>
            <label className="block text-sm text-white/60 mb-2">
              Postal Code
            </label>
            <GlassInput
              value={formData.postal_code}
              onChange={(e) => updateField("postal_code", e.target.value)}
              placeholder="10001"
            />
          </div>
        </div>
      </div>

      {/* Emergency Contact */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold flex items-center">
          Emergency Contact
          <InfoTooltip text="Who to contact in case of emergency - very important!" />
        </h3>

        <div>
          <label className="block text-sm text-white/60 mb-2">Name</label>
          <GlassInput
            value={formData.emergency_contact_name}
            onChange={(e) =>
              updateField("emergency_contact_name", e.target.value)
            }
            placeholder="Jane Smith"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-white/60 mb-2">Phone</label>
            <GlassInput
              type="tel"
              value={formData.emergency_contact_phone}
              onChange={(e) =>
                updateField("emergency_contact_phone", e.target.value)
              }
              placeholder="+1 234 567 8900"
            />
          </div>
          <div>
            <label className="block text-sm text-white/60 mb-2">
              Relationship
            </label>
            <GlassInput
              value={formData.emergency_contact_relationship}
              onChange={(e) =>
                updateField("emergency_contact_relationship", e.target.value)
              }
              placeholder="Spouse"
            />
          </div>
        </div>
      </div>

      {/* Banking Details */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold flex items-center">
          Banking Details
          <InfoTooltip text="Needed to pay them - keep this information secure!" />
        </h3>

        <div>
          <label className="block text-sm text-white/60 mb-2">
            Bank Name
          </label>
          <GlassInput
            value={formData.bank_name}
            onChange={(e) => updateField("bank_name", e.target.value)}
            placeholder="Chase Bank"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-white/60 mb-2">
              Account Number
            </label>
            <GlassInput
              value={formData.bank_account_number}
              onChange={(e) =>
                updateField("bank_account_number", e.target.value)
              }
              placeholder="1234567890"
              type="password"
            />
          </div>
          <div>
            <label className="block text-sm text-white/60 mb-2">
              Routing Number
            </label>
            <GlassInput
              value={formData.bank_routing_number}
              onChange={(e) =>
                updateField("bank_routing_number", e.target.value)
              }
              placeholder="021000021"
            />
          </div>
        </div>
      </div>

      {/* Tax & Legal */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold flex items-center">
          Tax & Legal Information
          <InfoTooltip text="Required for tax compliance and legal employment" />
        </h3>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-white/60 mb-2">
              Tax ID / National ID
            </label>
            <GlassInput
              value={formData.tax_id}
              onChange={(e) => updateField("tax_id", e.target.value)}
              placeholder="123-45-6789"
              type="password"
            />
          </div>
          <div>
            <label className="block text-sm text-white/60 mb-2">
              Social Security Number
            </label>
            <GlassInput
              value={formData.social_security_number}
              onChange={(e) =>
                updateField("social_security_number", e.target.value)
              }
              placeholder="123-45-6789"
              type="password"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-white/60 mb-2">
              Work Permit Number (if applicable)
            </label>
            <GlassInput
              value={formData.work_permit_number}
              onChange={(e) =>
                updateField("work_permit_number", e.target.value)
              }
              placeholder="WP123456"
            />
          </div>
          <div>
            <label className="block text-sm text-white/60 mb-2">
              Work Permit Expiry
            </label>
            <GlassInput
              type="date"
              value={formData.work_permit_expiry}
              onChange={(e) =>
                updateField("work_permit_expiry", e.target.value)
              }
            />
          </div>
        </div>
      </div>

      {/* Compensation */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold flex items-center">
          Compensation
          <InfoTooltip text="How much you'll pay them and how often" />
        </h3>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm text-white/60 mb-2">
              Gross Salary
            </label>
            <GlassInput
              type="number"
              value={formData.gross_salary}
              onChange={(e) => updateField("gross_salary", e.target.value)}
              placeholder="50000"
            />
          </div>
          <div>
            <label className="block text-sm text-white/60 mb-2">
              Pay Frequency
            </label>
            <GlassSelect
              value={formData.pay_frequency}
              onChange={(e) => updateField("pay_frequency", e.target.value)}
            >
              <option value="weekly">Weekly</option>
              <option value="biweekly">Bi-weekly</option>
              <option value="monthly">Monthly</option>
              <option value="annual">Annual</option>
            </GlassSelect>
          </div>
          <div>
            <label className="block text-sm text-white/60 mb-2">
              Currency
            </label>
            <GlassInput
              value={formData.currency}
              onChange={(e) => updateField("currency", e.target.value)}
              placeholder="USD"
            />
          </div>
        </div>
      </div>

      {/* Benefits */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold flex items-center">
          Benefits & Deductions
          <InfoTooltip text="Additional benefits and automatic deductions" />
        </h3>

        <div className="flex items-center gap-2">
          <GlassCheckbox
            checked={formData.health_insurance}
            onChange={(checked) => updateField("health_insurance", checked)}
          />
          <label className="text-sm">Enrolled in Health Insurance</label>
        </div>

        <div>
          <label className="block text-sm text-white/60 mb-2">
            Pension Contribution (%)
            <InfoTooltip text="Percentage of salary for pension/retirement savings" />
          </label>
          <GlassInput
            type="number"
            value={formData.pension_contribution_percent}
            onChange={(e) =>
              updateField("pension_contribution_percent", e.target.value)
            }
            placeholder="5"
            min="0"
            max="100"
          />
        </div>
      </div>

      {/* Platform Access */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold flex items-center">
          Platform Access
          <InfoTooltip text="Give them access to this system as a subtenant" />
        </h3>

        <div className="flex items-center gap-2">
          <GlassCheckbox
            checked={formData.can_access_platform}
            onChange={(checked) => updateField("can_access_platform", checked)}
          />
          <label className="text-sm">Create Platform Account (Subtenant)</label>
        </div>

        {formData.can_access_platform && (
          <div>
            <label className="block text-sm text-white/60 mb-2">
              Platform Role & Accessibility
              <InfoTooltip text="What they can do in the system and what they can access" />
            </label>
            <GlassSelect
              value={formData.platform_role}
              onChange={(e) => updateField("platform_role", e.target.value)}
            >
              <option value="">Select role...</option>
              <option value="viewer">Viewer (View only)</option>
              <option value="employee">Employee (Basic access)</option>
              <option value="manager">Manager (Team management)</option>
              <option value="hr">HR (Full HR access)</option>
              <option value="admin">Admin (Full system access)</option>
            </GlassSelect>
          </div>
        )}
      </div>

      {/* Notes */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Additional Notes</h3>
        <GlassTextArea
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
