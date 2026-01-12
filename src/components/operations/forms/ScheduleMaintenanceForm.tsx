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

interface ScheduleMaintenanceFormProps {
  onBack: () => void;
  onSuccess: () => void;
}

interface Asset {
  id: string;
  name: string;
  sku: string | null;
}

interface User {
  id: string;
  fullName: string;
}

export default function ScheduleMaintenanceForm({ onBack, onSuccess }: ScheduleMaintenanceFormProps) {
  const { addToast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [users, setUsers] = useState<User[]>([]);

  const [formData, setFormData] = useState({
    assetId: "",
    maintenanceType: "preventive",
    priority: "medium",
    scheduledDate: new Date().toISOString().split("T")[0],
    estimatedDuration: "",
    assignedToId: "",
    description: "",
    notes: "",
    estimatedCost: "",
  });

  useEffect(() => {
    loadAssets();
    loadUsers();
  }, []);

  const loadAssets = async () => {
    try {
      const res = await fetch("/api/master/items?type=asset&limit=100");
      if (res.ok) {
        const data = await res.json();
        setAssets(data.items || []);
      }
    } catch (error) {
      console.error("Error loading assets:", error);
    }
  };

  const loadUsers = async () => {
    try {
      const res = await fetch("/api/auth/users");
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users || []);
      }
    } catch (error) {
      console.error("Error loading users:", error);
    }
  };

  const updateField = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    try {
      setIsSubmitting(true);

      if (!formData.assetId) {
        addToast("error", "Asset is required");
        return;
      }

      if (!formData.scheduledDate) {
        addToast("error", "Scheduled date is required");
        return;
      }

      if (!formData.description) {
        addToast("error", "Description is required");
        return;
      }

      const res = await fetch("/api/operations/maintenance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemId: formData.assetId,
          maintenanceType: formData.maintenanceType,
          priority: formData.priority,
          scheduledDate: formData.scheduledDate,
          estimatedDuration: formData.estimatedDuration ? parseInt(formData.estimatedDuration) : null,
          assignedToId: formData.assignedToId || null,
          description: formData.description,
          notes: formData.notes || null,
          estimatedCost: formData.estimatedCost || null,
        }),
      });

      if (res.ok) {
        onSuccess();
      } else {
        const error = await res.json();
        addToast("error", error.message || "Failed to schedule maintenance");
      }
    } catch (error) {
      console.error("Error scheduling maintenance:", error);
      addToast("error", "Failed to schedule maintenance");
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

  const assetOptions = [
    { value: "", label: "Select asset..." },
    ...assets.map((a) => ({ value: a.id, label: `${a.name}${a.sku ? ` (${a.sku})` : ""}` })),
  ];

  const userOptions = [
    { value: "", label: "Select assignee..." },
    ...users.map((u) => ({ value: u.id, label: u.fullName })),
  ];

  const maintenanceTypeOptions = [
    { value: "preventive", label: "Preventive" },
    { value: "corrective", label: "Corrective" },
    { value: "emergency", label: "Emergency" },
    { value: "inspection", label: "Inspection" },
  ];

  const priorityOptions = [
    { value: "low", label: "Low" },
    { value: "medium", label: "Medium" },
    { value: "high", label: "High" },
    { value: "critical", label: "Critical" },
  ];

  return (
    <div className="space-y-6">
      <GlassButton onClick={onBack} variant="ghost" size="sm">
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to menu
      </GlassButton>

      {/* Asset Selection */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold flex items-center">
          Asset
          <InfoTooltip text="Select the asset requiring maintenance" />
        </h3>

        <GlassSelect
          label="Asset *"
          options={assetOptions}
          value={formData.assetId}
          onChange={(e) => updateField("assetId", e.target.value)}
        />
      </div>

      {/* Maintenance Details */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold flex items-center">
          Maintenance Details
          <InfoTooltip text="Type and priority of maintenance work" />
        </h3>

        <div className="grid grid-cols-2 gap-4">
          <GlassSelect
            label="Maintenance Type *"
            options={maintenanceTypeOptions}
            value={formData.maintenanceType}
            onChange={(e) => updateField("maintenanceType", e.target.value)}
          />
          <GlassSelect
            label="Priority *"
            options={priorityOptions}
            value={formData.priority}
            onChange={(e) => updateField("priority", e.target.value)}
          />
        </div>

        <GlassTextarea
          label="Description *"
          value={formData.description}
          onChange={(e) => updateField("description", e.target.value)}
          rows={3}
          placeholder="Describe the maintenance work to be performed..."
        />
      </div>

      {/* Schedule */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold flex items-center">
          Schedule
          <InfoTooltip text="When the maintenance should be performed" />
        </h3>

        <div className="grid grid-cols-2 gap-4">
          <GlassInput
            label="Scheduled Date *"
            type="date"
            value={formData.scheduledDate}
            onChange={(e) => updateField("scheduledDate", e.target.value)}
          />
          <GlassInput
            label="Estimated Duration (hours)"
            type="number"
            value={formData.estimatedDuration}
            onChange={(e) => updateField("estimatedDuration", e.target.value)}
            placeholder="0"
          />
        </div>
      </div>

      {/* Assignment */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold flex items-center">
          Assignment
          <InfoTooltip text="Who will perform the maintenance" />
        </h3>

        <GlassSelect
          label="Assigned To"
          options={userOptions}
          value={formData.assignedToId}
          onChange={(e) => updateField("assignedToId", e.target.value)}
        />
      </div>

      {/* Cost */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold flex items-center">
          Cost Estimate
          <InfoTooltip text="Expected cost of the maintenance work" />
        </h3>

        <GlassInput
          label="Estimated Cost"
          type="number"
          value={formData.estimatedCost}
          onChange={(e) => updateField("estimatedCost", e.target.value)}
          placeholder="0.00"
        />
      </div>

      {/* Notes */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Additional Notes</h3>
        <GlassTextarea
          value={formData.notes}
          onChange={(e) => updateField("notes", e.target.value)}
          rows={2}
          placeholder="Any additional notes..."
        />
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-6 border-t border-white/10">
        <GlassButton onClick={onBack} variant="ghost">
          Cancel
        </GlassButton>
        <GlassButton onClick={handleSubmit} variant="primary" disabled={isSubmitting}>
          {isSubmitting ? "Scheduling..." : "Schedule Maintenance"}
        </GlassButton>
      </div>
    </div>
  );
}
