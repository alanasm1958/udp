"use client";

import * as React from "react";
import {
    GlassCard,
    GlassInput,
    GlassButton,
    useToast,
} from "@/components/ui/glass";
import { apiPost } from "@/lib/http";

interface Customer {
    id: string;
    name: string;
    code: string;
}

interface CustomerSelectorProps {
    customers: Customer[];
    value: string;
    onChange: (customerId: string) => void;
    onCustomerCreated?: () => void;
}

type SelectionMode = "general" | "existing" | "new";

const WALKIN_CODE = "WALKIN";

export function CustomerSelector({
    customers,
    value,
    onChange,
    onCustomerCreated,
}: CustomerSelectorProps) {
    const { addToast } = useToast();
    const [mode, setMode] = React.useState<SelectionMode>("existing");
    const [newCustomerData, setNewCustomerData] = React.useState({
        name: "",
        email: "",
        phone: "",
    });
    const [creating, setCreating] = React.useState(false);

    // Find Walk-in customer
    const walkinCustomer = customers.find((c) => c.code === WALKIN_CODE);

    // Determine initial mode based on current value
    React.useEffect(() => {
        if (!value) {
            setMode("existing");
        } else if (walkinCustomer && value === walkinCustomer.id) {
            setMode("general");
        } else {
            setMode("existing");
        }
    }, [value, walkinCustomer]);

    const handleModeChange = (newMode: SelectionMode) => {
        setMode(newMode);
        if (newMode === "general" && walkinCustomer) {
            onChange(walkinCustomer.id);
        } else if (newMode === "existing") {
            onChange("");
        } else if (newMode === "new") {
            onChange("");
            setNewCustomerData({ name: "", email: "", phone: "" });
        }
    };

    const handleExistingChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        onChange(e.target.value);
    };

    const handleCreateCustomer = async () => {
        if (!newCustomerData.name.trim()) {
            addToast("error", "Customer name is required");
            return;
        }

        try {
            setCreating(true);
            const result = await apiPost<{ id: string }>("/api/sales-customers/customers", {
                name: newCustomerData.name,
                email: newCustomerData.email || null,
                phone: newCustomerData.phone || null,
            });
            onChange(result.id);
            setMode("existing");
            addToast("success", "Customer created");
            onCustomerCreated?.();
        } catch (err) {
            addToast("error", err instanceof Error ? err.message : "Failed to create customer");
        } finally {
            setCreating(false);
        }
    };

    // Filter out Walk-in from regular customer list
    const regularCustomers = customers.filter((c) => c.code !== WALKIN_CODE);

    return (
        <div className="space-y-3">
            {/* Explanatory Note */}
            <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                <p className="text-xs text-blue-400">
                    <strong>Choose a customer:</strong> Use &quot;General&quot; for walk-in/one-time sales,
                    select an existing customer, or create a new one inline.
                </p>
            </div>

            {/* Selection Mode */}
            <div className="flex gap-2">
                <button
                    type="button"
                    onClick={() => handleModeChange("general")}
                    className={`flex-1 px-3 py-2 text-sm rounded-lg border transition-colors ${mode === "general"
                            ? "bg-white/10 border-white/30 text-white"
                            : "border-white/10 text-white/50 hover:text-white hover:border-white/20"
                        }`}
                >
                    General (Walk-in)
                </button>
                <button
                    type="button"
                    onClick={() => handleModeChange("existing")}
                    className={`flex-1 px-3 py-2 text-sm rounded-lg border transition-colors ${mode === "existing"
                            ? "bg-white/10 border-white/30 text-white"
                            : "border-white/10 text-white/50 hover:text-white hover:border-white/20"
                        }`}
                >
                    Existing Customer
                </button>
                <button
                    type="button"
                    onClick={() => handleModeChange("new")}
                    className={`flex-1 px-3 py-2 text-sm rounded-lg border transition-colors ${mode === "new"
                            ? "bg-white/10 border-white/30 text-white"
                            : "border-white/10 text-white/50 hover:text-white hover:border-white/20"
                        }`}
                >
                    + New Customer
                </button>
            </div>

            {/* Mode-specific content */}
            {mode === "general" && (
                <GlassCard padding="sm">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-gray-500/20 flex items-center justify-center">
                            <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                            </svg>
                        </div>
                        <div>
                            <p className="text-sm font-medium text-white">Walk-in Customer</p>
                            <p className="text-xs text-white/50">One-time purchase, no account needed</p>
                        </div>
                    </div>
                </GlassCard>
            )}

            {mode === "existing" && (
                <select
                    value={value}
                    onChange={handleExistingChange}
                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30"
                    required
                >
                    <option value="">Select a customer...</option>
                    {regularCustomers.map((c) => (
                        <option key={c.id} value={c.id}>
                            {c.name} ({c.code})
                        </option>
                    ))}
                </select>
            )}

            {mode === "new" && (
                <GlassCard padding="sm">
                    <div className="space-y-3">
                        <GlassInput
                            label="Customer Name"
                            value={newCustomerData.name}
                            onChange={(e) => setNewCustomerData({ ...newCustomerData, name: e.target.value })}
                            placeholder="Enter customer name"
                            required
                        />
                        <div className="grid grid-cols-2 gap-3">
                            <GlassInput
                                label="Email"
                                type="email"
                                value={newCustomerData.email}
                                onChange={(e) => setNewCustomerData({ ...newCustomerData, email: e.target.value })}
                                placeholder="email@example.com"
                            />
                            <GlassInput
                                label="Phone"
                                value={newCustomerData.phone}
                                onChange={(e) => setNewCustomerData({ ...newCustomerData, phone: e.target.value })}
                                placeholder="(555) 123-4567"
                            />
                        </div>
                        <GlassButton
                            type="button"
                            variant="primary"
                            size="sm"
                            onClick={handleCreateCustomer}
                            disabled={creating || !newCustomerData.name.trim()}
                            className="w-full"
                        >
                            {creating ? "Creating..." : "Create & Select Customer"}
                        </GlassButton>
                    </div>
                </GlassCard>
            )}
        </div>
    );
}
