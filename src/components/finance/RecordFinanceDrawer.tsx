"use client";

import { useState } from "react";
import { SlideOver, GlassCard, GlassButton, useToast } from "@/components/ui/glass";
import {
  DollarSign,
  Receipt,
  FileText,
  CreditCard,
  BookOpen,
  ArrowLeft,
  ArrowRightLeft,
  Building2,
} from "lucide-react";
import RecordPaymentForm from "./forms/RecordPaymentForm";
import RecordExpenseForm from "./forms/RecordExpenseForm";
import CreateInvoiceForm from "./forms/CreateInvoiceForm";
import EnterBillForm from "./forms/EnterBillForm";
import ManualJournalForm from "./forms/ManualJournalForm";

interface RecordFinanceDrawerProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

type ViewType =
  | "menu"
  | "record-payment"
  | "record-expense"
  | "create-invoice"
  | "enter-bill"
  | "manual-journal"
  | "bank-transfer";

const ACTIVITY_CARDS = [
  {
    id: "record-payment",
    icon: DollarSign,
    title: "Record a Payment",
    description: "Money received from customer or paid to vendor",
    color: "text-green-400",
    whyItMatters: "Track cash flow accurately",
  },
  {
    id: "record-expense",
    icon: Receipt,
    title: "Record a Business Expense",
    description: "Quick expense entry with receipt capture",
    color: "text-orange-400",
    whyItMatters: "Track spending and tax deductions",
  },
  {
    id: "create-invoice",
    icon: FileText,
    title: "Create an Invoice",
    description: "Bill a customer for goods or services",
    color: "text-blue-400",
    whyItMatters: "Track what customers owe you",
  },
  {
    id: "enter-bill",
    icon: CreditCard,
    title: "Enter a Bill",
    description: "Record a bill from a vendor",
    color: "text-purple-400",
    whyItMatters: "Track what you owe vendors",
  },
  {
    id: "bank-transfer",
    icon: ArrowRightLeft,
    title: "Bank Transfer",
    description: "Transfer between your accounts",
    color: "text-cyan-400",
    whyItMatters: "Keep account balances accurate",
  },
  {
    id: "manual-journal",
    icon: BookOpen,
    title: "Manual Journal Entry",
    description: "For accountants: direct ledger entry",
    color: "text-pink-400",
    whyItMatters: "Advanced adjustments and corrections",
  },
];

export default function RecordFinanceDrawer({
  open,
  onClose,
  onSuccess,
}: RecordFinanceDrawerProps) {
  const [view, setView] = useState<ViewType>("menu");
  const { addToast } = useToast();

  const handleClose = () => {
    setView("menu");
    onClose();
  };

  const handleSuccess = () => {
    addToast("success", "Financial activity recorded successfully");
    setView("menu");
    onSuccess();
  };

  const handleBack = () => {
    setView("menu");
  };

  const getTitle = () => {
    switch (view) {
      case "menu":
        return "Record Financial Activity";
      case "record-payment":
        return "Record a Payment";
      case "record-expense":
        return "Record a Business Expense";
      case "create-invoice":
        return "Create an Invoice";
      case "enter-bill":
        return "Enter a Bill";
      case "manual-journal":
        return "Manual Journal Entry";
      case "bank-transfer":
        return "Bank Transfer";
      default:
        return "Record Financial Activity";
    }
  };

  const renderContent = () => {
    switch (view) {
      case "menu":
        return (
          <div className="space-y-4">
            <p className="text-white/60 text-sm">
              What financial activity would you like to record?
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {ACTIVITY_CARDS.map((card) => (
                <GlassCard
                  key={card.id}
                  className="p-4 cursor-pointer hover:bg-white/10 transition-colors"
                  onClick={() => setView(card.id as ViewType)}
                >
                  <div className="flex items-start gap-4">
                    <div className={`p-3 rounded-lg bg-white/5 ${card.color}`}>
                      <card.icon className="w-6 h-6" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-white">{card.title}</h3>
                      <p className="text-sm text-white/60 mt-1">{card.description}</p>
                      <p className="text-xs text-white/40 mt-2 italic">
                        Why: {card.whyItMatters}
                      </p>
                    </div>
                  </div>
                </GlassCard>
              ))}
            </div>
          </div>
        );

      case "record-payment":
        return <RecordPaymentForm onBack={handleBack} onSuccess={handleSuccess} />;

      case "record-expense":
        return <RecordExpenseForm onBack={handleBack} onSuccess={handleSuccess} />;

      case "create-invoice":
        return <CreateInvoiceForm onBack={handleBack} onSuccess={handleSuccess} />;

      case "enter-bill":
        return <EnterBillForm onBack={handleBack} onSuccess={handleSuccess} />;

      case "manual-journal":
        return <ManualJournalForm onBack={handleBack} onSuccess={handleSuccess} />;

      case "bank-transfer":
        return (
          <div className="space-y-4">
            <GlassButton onClick={handleBack} variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to menu
            </GlassButton>
            <GlassCard className="p-8 text-center">
              <Building2 className="w-12 h-12 text-cyan-400/50 mx-auto mb-4" />
              <p className="text-white/60">Bank transfer form coming soon...</p>
              <p className="text-sm text-white/40 mt-2">
                For now, use Manual Journal Entry to record transfers between accounts.
              </p>
            </GlassCard>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <SlideOver open={open} onClose={handleClose} title={getTitle()} width="lg">
      <div className="p-6">{renderContent()}</div>
    </SlideOver>
  );
}
