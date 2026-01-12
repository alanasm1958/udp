'use client';

import React, { useState, useEffect, Suspense, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  GlassCard,
  GlassButton,
  GlassBadge,
  GlassInput,
  GlassSelect,
  Spinner,
  PageHeader,
} from '@/components/ui/glass';
import { apiGet, apiPost } from '@/lib/http';

// ============================================================================
// TYPES
// ============================================================================

interface BusinessProfile {
  id: string;
  legalName: string;
  tradeName?: string;
  legalStructure?: string;
  jurisdiction?: string;
  taxId?: string;
  primaryIndustry?: string;
  annualRevenue?: string;
  employeeCount?: number;
  operatingLocations?: Array<{ state?: string; country?: string }>;
  businessActivities?: string[];
  regulatedActivities?: string[];
  lastAnalyzedAt?: string;
}

interface GrcAnalytics {
  compliance: {
    overallScore: number;
    satisfiedCount: number;
    unsatisfiedCount: number;
    atRiskCount: number;
    unknownCount: number;
    totalRequirements: number;
  };
  riskProfile: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  upcomingDeadlines: {
    overdue: number;
    thisWeek: number;
    thisMonth: number;
    nextQuarter: number;
  };
  byCategory: Record<
    string,
    {
      satisfied: number;
      unsatisfied: number;
      percentage: number;
    }
  >;
  openTasks: number;
  activeAlerts: number;
}

interface GrcTask {
  id: string;
  requirementId: string;
  requirementTitle: string;
  title: string;
  description: string | null;
  status: 'open' | 'blocked' | 'completed';
  dueDate?: string;
  createdAt: string;
}

interface GrcAlert {
  id: string;
  requirementId?: string;
  title: string;
  message?: string;
  severity: 'info' | 'warning' | 'critical';
  status: 'active' | 'resolved';
  createdAt: string;
}

interface Requirement {
  id: string;
  requirementCode: string;
  title: string;
  description: string | null;
  category: string;
  status: 'satisfied' | 'unsatisfied' | 'at_risk' | 'unknown';
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  closureCriteria: object;
  evidenceData?: object;
  aiExplanation?: string;
  satisfiedAt?: string;
}

// ============================================================================
// ICONS
// ============================================================================

function ShieldCheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
    </svg>
  );
}

function ExclamationTriangleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
    </svg>
  );
}

function ClockIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function CheckCircleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function DocumentTextIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    </svg>
  );
}

function ScaleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v17.25m0 0c-1.472 0-2.882.265-4.185.75M12 20.25c1.472 0 2.882.265 4.185.75M18.75 4.97A48.416 48.416 0 0012 4.5c-2.291 0-4.545.16-6.75.47m13.5 0c1.01.143 2.01.317 3 .52m-3-.52l2.62 10.726c.122.499-.106 1.028-.589 1.202a5.988 5.988 0 01-2.031.352 5.988 5.988 0 01-2.031-.352c-.483-.174-.711-.703-.59-1.202L18.75 4.971zm-16.5.52c.99-.203 1.99-.377 3-.52m0 0l2.62 10.726c.122.499-.106 1.028-.589 1.202a5.989 5.989 0 01-2.031.352 5.989 5.989 0 01-2.031-.352c-.483-.174-.711-.703-.59-1.202L5.25 4.971z" />
    </svg>
  );
}

function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
    </svg>
  );
}

function ClipboardDocumentCheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M11.35 3.836c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m8.9-4.414c.376.023.75.05 1.124.08 1.131.094 1.976 1.057 1.976 2.192V16.5A2.25 2.25 0 0118 18.75h-2.25m-7.5-10.5H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V18.75m-7.5-10.5h6.375c.621 0 1.125.504 1.125 1.125v9.375m-8.25-3l1.5 1.5 3-3.75" />
    </svg>
  );
}

function BuildingLibraryIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0012 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18M12 6.75h.008v.008H12V6.75z" />
    </svg>
  );
}

function BellAlertIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
    </svg>
  );
}

function SparklesIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
    </svg>
  );
}

function XMarkIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

// ============================================================================
// CONSTANTS
// ============================================================================

const LEGAL_STRUCTURES = [
  { value: '', label: 'Select structure...' },
  { value: 'Sole Proprietorship', label: 'Sole Proprietorship' },
  { value: 'Partnership', label: 'Partnership' },
  { value: 'LLC', label: 'LLC' },
  { value: 'Corporation', label: 'Corporation' },
  { value: 'S-Corp', label: 'S-Corp' },
  { value: 'Non-Profit', label: 'Non-Profit' },
];

// ============================================================================
// PROFILE MODAL
// ============================================================================

function ProfileModal({
  profile,
  onClose,
  onSave,
  onAnalyze,
  saving,
  analyzing,
}: {
  profile: BusinessProfile | null;
  onClose: () => void;
  onSave: (data: Partial<BusinessProfile>) => Promise<void>;
  onAnalyze: () => Promise<void>;
  saving: boolean;
  analyzing: boolean;
}) {
  const [formData, setFormData] = useState({
    legalName: profile?.legalName || '',
    tradeName: profile?.tradeName || '',
    legalStructure: profile?.legalStructure || '',
    jurisdiction: profile?.jurisdiction || '',
    taxId: profile?.taxId || '',
    primaryIndustry: profile?.primaryIndustry || '',
    annualRevenue: profile?.annualRevenue || '',
    employeeCount: profile?.employeeCount?.toString() || '',
    operatingStates: profile?.operatingLocations?.map((l) => l.state).filter(Boolean).join(', ') || '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave({
      legalName: formData.legalName,
      tradeName: formData.tradeName || undefined,
      legalStructure: formData.legalStructure || undefined,
      jurisdiction: formData.jurisdiction || undefined,
      taxId: formData.taxId || undefined,
      primaryIndustry: formData.primaryIndustry || undefined,
      annualRevenue: formData.annualRevenue || undefined,
      employeeCount: formData.employeeCount ? parseInt(formData.employeeCount, 10) : undefined,
      operatingLocations: formData.operatingStates
        ? formData.operatingStates.split(',').map((s) => ({ state: s.trim() }))
        : [],
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <GlassCard className="relative z-10 w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-blue-500/20">
              <BuildingLibraryIcon className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white">Business Profile</h2>
              <p className="text-white/50 text-sm">
                {profile ? 'Update your business information' : 'Set up your business profile'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
            <XMarkIcon className="w-5 h-5 text-white/50" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <GlassInput
              label="Legal Name *"
              value={formData.legalName}
              onChange={(e) => setFormData({ ...formData, legalName: e.target.value })}
              placeholder="Your Company Inc."
              required
            />
            <GlassInput
              label="Trade Name (DBA)"
              value={formData.tradeName}
              onChange={(e) => setFormData({ ...formData, tradeName: e.target.value })}
              placeholder="Brand Name"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <GlassSelect
              label="Legal Structure"
              value={formData.legalStructure}
              onChange={(e) => setFormData({ ...formData, legalStructure: e.target.value })}
              options={LEGAL_STRUCTURES}
            />
            <GlassInput
              label="State of Incorporation"
              value={formData.jurisdiction}
              onChange={(e) => setFormData({ ...formData, jurisdiction: e.target.value })}
              placeholder="California"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <GlassInput
              label="Tax ID (EIN)"
              value={formData.taxId}
              onChange={(e) => setFormData({ ...formData, taxId: e.target.value })}
              placeholder="XX-XXXXXXX"
            />
            <GlassInput
              label="Primary Industry"
              value={formData.primaryIndustry}
              onChange={(e) => setFormData({ ...formData, primaryIndustry: e.target.value })}
              placeholder="Technology, Manufacturing, etc."
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <GlassInput
              label="Annual Revenue ($)"
              type="number"
              value={formData.annualRevenue}
              onChange={(e) => setFormData({ ...formData, annualRevenue: e.target.value })}
              placeholder="5000000"
            />
            <GlassInput
              label="Number of Employees"
              type="number"
              value={formData.employeeCount}
              onChange={(e) => setFormData({ ...formData, employeeCount: e.target.value })}
              placeholder="50"
            />
          </div>

          <GlassInput
            label="Operating States (comma separated)"
            value={formData.operatingStates}
            onChange={(e) => setFormData({ ...formData, operatingStates: e.target.value })}
            placeholder="California, Texas, New York"
          />

          <div className="flex gap-3 pt-4">
            <GlassButton type="submit" disabled={saving || !formData.legalName}>
              {saving ? <Spinner size="sm" /> : 'Save Profile'}
            </GlassButton>
            {profile && (
              <GlassButton
                type="button"
                variant="primary"
                onClick={onAnalyze}
                disabled={analyzing}
              >
                {analyzing ? (
                  <>
                    <Spinner size="sm" />
                    <span className="ml-2">Analyzing...</span>
                  </>
                ) : (
                  <>
                    <SparklesIcon className="w-5 h-5 mr-2" />
                    Analyze & Generate Requirements
                  </>
                )}
              </GlassButton>
            )}
          </div>
        </form>
      </GlassCard>
    </div>
  );
}

// ============================================================================
// REQUIREMENT DETAIL MODAL
// ============================================================================

function RequirementModal({
  requirement,
  onClose,
  onSubmitEvidence,
  submitting,
}: {
  requirement: Requirement;
  onClose: () => void;
  onSubmitEvidence: (evidence: { documents?: Array<{ type: string }>; fields?: Record<string, string> }) => Promise<void>;
  submitting: boolean;
}) {
  const [evidenceForm, setEvidenceForm] = useState<Record<string, string>>({});
  const [documentTypes, setDocumentTypes] = useState<string[]>([]);

  const closureCriteria = requirement.closureCriteria as {
    required_documents?: string[];
    required_fields?: string[];
  };
  const evidenceData = requirement.evidenceData as {
    documents?: Array<{ type: string }>;
    fields?: Record<string, string | number | boolean>;
  } | undefined;

  const requiredDocs = closureCriteria?.required_documents || [];
  const requiredFields = closureCriteria?.required_fields || [];
  const existingDocs = evidenceData?.documents?.map((d) => d.type) || [];
  const existingFields = evidenceData?.fields || {};

  const handleSubmit = async () => {
    const evidence: { documents?: Array<{ type: string }>; fields?: Record<string, string> } = {};
    if (documentTypes.length > 0) {
      evidence.documents = documentTypes.map((type) => ({ type }));
    }
    if (Object.keys(evidenceForm).length > 0) {
      evidence.fields = evidenceForm;
    }
    await onSubmitEvidence(evidence);
  };

  const hasNewEvidence = documentTypes.length > 0 || Object.keys(evidenceForm).some((k) => evidenceForm[k]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <GlassCard className="relative z-10 w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className={`px-2 py-1 text-xs font-medium rounded ${
                requirement.status === 'satisfied' ? 'bg-emerald-500/20 text-emerald-300' :
                requirement.status === 'unsatisfied' ? 'bg-red-500/20 text-red-300' :
                requirement.status === 'at_risk' ? 'bg-amber-500/20 text-amber-300' :
                'bg-gray-500/20 text-gray-300'
              }`}>
                {requirement.status.replace('_', ' ')}
              </span>
              <span className={`px-2 py-1 text-xs font-medium rounded ${
                requirement.riskLevel === 'critical' ? 'bg-red-500/20 text-red-300' :
                requirement.riskLevel === 'high' ? 'bg-orange-500/20 text-orange-300' :
                requirement.riskLevel === 'medium' ? 'bg-amber-500/20 text-amber-300' :
                'bg-blue-500/20 text-blue-300'
              }`}>
                {requirement.riskLevel}
              </span>
            </div>
            <h2 className="text-xl font-semibold text-white">{requirement.title}</h2>
            <p className="text-white/50 text-sm">{requirement.requirementCode}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
            <XMarkIcon className="w-5 h-5 text-white/50" />
          </button>
        </div>

        {requirement.aiExplanation && (
          <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 mb-4">
            <div className="flex items-start gap-2">
              <SparklesIcon className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-white/80">{requirement.aiExplanation}</p>
            </div>
          </div>
        )}

        {requirement.description && (
          <p className="text-sm text-white/70 mb-4">{requirement.description}</p>
        )}

        <div className="space-y-4">
          <h3 className="text-sm font-medium text-white">Closure Criteria</h3>

          {requiredDocs.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-white/50">Required Documents:</p>
              {requiredDocs.map((docType) => {
                const isProvided = existingDocs.includes(docType) || documentTypes.includes(docType);
                return (
                  <div key={docType} className="flex items-center gap-2">
                    {isProvided ? (
                      <CheckCircleIcon className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <div className="w-4 h-4 rounded-full border border-white/30" />
                    )}
                    <span className={`text-sm ${isProvided ? 'text-white' : 'text-white/50'}`}>
                      {docType.replace(/_/g, ' ')}
                    </span>
                    {!isProvided && requirement.status !== 'satisfied' && (
                      <button
                        onClick={() => setDocumentTypes([...documentTypes, docType])}
                        className="text-xs text-blue-400 hover:text-blue-300"
                      >
                        + Mark as uploaded
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {requiredFields.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-white/50">Required Information:</p>
              {requiredFields.map((field) => {
                const existingValue = existingFields[field];
                const isProvided = existingValue !== undefined && existingValue !== '';
                return (
                  <div key={field} className="space-y-1">
                    <div className="flex items-center gap-2">
                      {isProvided ? (
                        <CheckCircleIcon className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <div className="w-4 h-4 rounded-full border border-white/30" />
                      )}
                      <span className={`text-sm ${isProvided ? 'text-white' : 'text-white/50'}`}>
                        {field.replace(/_/g, ' ')}
                      </span>
                      {isProvided && (
                        <span className="text-xs text-white/40">: {String(existingValue)}</span>
                      )}
                    </div>
                    {!isProvided && requirement.status !== 'satisfied' && (
                      <GlassInput
                        placeholder={`Enter ${field.replace(/_/g, ' ')}`}
                        value={evidenceForm[field] || ''}
                        onChange={(e) => setEvidenceForm({ ...evidenceForm, [field]: e.target.value })}
                        className="ml-6"
                      />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {requirement.status !== 'satisfied' && hasNewEvidence && (
          <div className="mt-6">
            <GlassButton onClick={handleSubmit} disabled={submitting} variant="primary">
              {submitting ? (
                <>
                  <Spinner size="sm" />
                  <span className="ml-2">Evaluating...</span>
                </>
              ) : (
                'Submit Evidence & Evaluate'
              )}
            </GlassButton>
          </div>
        )}

        {requirement.status === 'satisfied' && requirement.satisfiedAt && (
          <p className="text-xs text-emerald-400 mt-4">
            Satisfied on {new Date(requirement.satisfiedAt).toLocaleDateString()}
          </p>
        )}
      </GlassCard>
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

function GRCPageContent() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<BusinessProfile | null>(null);
  const [analytics, setAnalytics] = useState<GrcAnalytics | null>(null);
  const [tasks, setTasks] = useState<GrcTask[]>([]);
  const [alerts, setAlerts] = useState<GrcAlert[]>([]);
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [saving, setSaving] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [selectedRequirement, setSelectedRequirement] = useState<Requirement | null>(null);

  // Fetch all data
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);

      // Fetch profile first
      const profileRes = await apiGet<{ profile: BusinessProfile | null }>('/api/grc/profile');
      setProfile(profileRes.profile);

      // If no profile, show setup
      if (!profileRes.profile) {
        setShowProfileModal(true);
        setLoading(false);
        return;
      }

      // Fetch all data in parallel
      const [analyticsRes, tasksRes, alertsRes, reqRes] = await Promise.all([
        apiGet<GrcAnalytics>('/api/grc/analytics'),
        apiGet<{ tasks: GrcTask[] }>('/api/grc/tasks?status=open&limit=10'),
        apiGet<{ alerts: GrcAlert[] }>('/api/grc/alerts?status=active'),
        apiGet<{ requirements: Requirement[] }>('/api/grc/requirements'),
      ]);

      setAnalytics(analyticsRes);
      setTasks(tasksRes.tasks || []);
      setAlerts(alertsRes.alerts || []);
      setRequirements(reqRes.requirements || []);
    } catch (error) {
      console.error('Error fetching GRC data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Save profile
  const handleSaveProfile = async (data: Partial<BusinessProfile>) => {
    try {
      setSaving(true);
      const res = await apiPost<{ profile: BusinessProfile }>('/api/grc/profile', data);
      setProfile(res.profile);
      if (!profile) {
        await handleAnalyze();
      }
    } catch (error) {
      console.error('Error saving profile:', error);
    } finally {
      setSaving(false);
    }
  };

  // Analyze profile
  const handleAnalyze = async () => {
    try {
      setAnalyzing(true);
      await apiPost('/api/grc/profile/analyze', {});
      await fetchData();
      setShowProfileModal(false);
    } catch (error) {
      console.error('Error analyzing profile:', error);
    } finally {
      setAnalyzing(false);
    }
  };

  // Submit evidence
  const handleSubmitEvidence = async (
    requirementId: string,
    evidence: { documents?: Array<{ type: string }>; fields?: Record<string, string> }
  ) => {
    try {
      setSubmitting(true);
      await apiPost(`/api/grc/requirements/${requirementId}/evidence`, evidence);
      await fetchData();
      setSelectedRequirement(null);
    } catch (error) {
      console.error('Error submitting evidence:', error);
    } finally {
      setSubmitting(false);
    }
  };

  // Calculate compliance status
  const getComplianceStatus = (score: number) => {
    if (score >= 90) return { label: 'Excellent', color: 'emerald' };
    if (score >= 75) return { label: 'Good', color: 'blue' };
    if (score >= 60) return { label: 'Fair', color: 'amber' };
    return { label: 'Needs Attention', color: 'red' };
  };

  const complianceStatus = analytics ? getComplianceStatus(analytics.compliance.overallScore) : null;
  const totalHighRisk = analytics ? analytics.riskProfile.critical + analytics.riskProfile.high : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="GRC"
        description="Governance, Risk & Compliance - Requirements-driven compliance management"
        actions={
          <GlassButton variant="primary" onClick={() => setShowProfileModal(true)}>
            <BuildingLibraryIcon className="w-5 h-5 mr-2" />
            Business Profile
          </GlassButton>
        }
      />

      {/* Profile Modal */}
      {showProfileModal && (
        <ProfileModal
          profile={profile}
          onClose={() => profile && setShowProfileModal(false)}
          onSave={handleSaveProfile}
          onAnalyze={handleAnalyze}
          saving={saving}
          analyzing={analyzing}
        />
      )}

      {/* Requirement Detail Modal */}
      {selectedRequirement && (
        <RequirementModal
          requirement={selectedRequirement}
          onClose={() => setSelectedRequirement(null)}
          onSubmitEvidence={(evidence) => handleSubmitEvidence(selectedRequirement.id, evidence)}
          submitting={submitting}
        />
      )}

      {/* Dashboard Content */}
      {analytics && (
        <>
          {/* Analytics Cards - Top Row (3 cards as per docs) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Compliance Score */}
            <GlassCard className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-white/60">Compliance Score</p>
                  <p className="text-3xl font-bold text-white mt-1">
                    {analytics.compliance.overallScore}%
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    <GlassBadge variant={
                      complianceStatus?.color === 'emerald' ? 'success' :
                      complianceStatus?.color === 'blue' ? 'info' :
                      complianceStatus?.color === 'amber' ? 'warning' : 'danger'
                    }>
                      {complianceStatus?.label}
                    </GlassBadge>
                  </div>
                  <p className="text-xs text-white/50 mt-2">
                    {analytics.compliance.satisfiedCount} of {analytics.compliance.totalRequirements} satisfied
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-emerald-500/20">
                  <ShieldCheckIcon className="w-6 h-6 text-emerald-400" />
                </div>
              </div>
            </GlassCard>

            {/* Risk Profile */}
            <GlassCard className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-white/60">Risk Profile</p>
                  <p className="text-3xl font-bold text-white mt-1">{totalHighRisk}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <GlassBadge variant={
                      totalHighRisk === 0 ? 'success' :
                      totalHighRisk <= 3 ? 'warning' : 'danger'
                    }>
                      {totalHighRisk === 0 ? 'Low Risk' : totalHighRisk <= 3 ? 'Moderate' : 'High Risk'}
                    </GlassBadge>
                  </div>
                  <p className="text-xs text-white/50 mt-2">
                    {analytics.riskProfile.critical} critical, {analytics.riskProfile.high} high
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-amber-500/20">
                  <ExclamationTriangleIcon className="w-6 h-6 text-amber-400" />
                </div>
              </div>
            </GlassCard>

            {/* Upcoming Deadlines */}
            <GlassCard className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-white/60">Upcoming Deadlines</p>
                  <p className="text-3xl font-bold text-white mt-1">
                    {analytics.upcomingDeadlines.thisWeek}
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    <GlassBadge variant={
                      analytics.upcomingDeadlines.overdue > 0 ? 'danger' :
                      analytics.upcomingDeadlines.thisWeek > 0 ? 'warning' : 'default'
                    }>
                      {analytics.upcomingDeadlines.overdue > 0
                        ? `${analytics.upcomingDeadlines.overdue} Overdue`
                        : 'This Week'}
                    </GlassBadge>
                  </div>
                  <p className="text-xs text-white/50 mt-2">
                    {analytics.upcomingDeadlines.thisMonth} this month
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-blue-500/20">
                  <ClockIcon className="w-6 h-6 text-blue-400" />
                </div>
              </div>
            </GlassCard>
          </div>

          {/* Compliance by Category */}
          {Object.keys(analytics.byCategory).length > 0 && (
            <GlassCard className="p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Compliance by Category</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Object.entries(analytics.byCategory).map(([category, data]) => (
                  <div
                    key={category}
                    className="p-4 rounded-lg bg-white/5 backdrop-blur-sm border border-white/10 cursor-pointer hover:bg-white/10 transition-colors"
                    onClick={() => {
                      const req = requirements.find((r) => r.category === category && r.status !== 'satisfied');
                      if (req) setSelectedRequirement(req);
                    }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-white/80 capitalize">
                        {category.replace(/_/g, ' ')}
                      </span>
                      <GlassBadge variant={
                        data.percentage >= 90 ? 'success' :
                        data.percentage >= 75 ? 'info' : 'warning'
                      }>
                        {data.percentage}%
                      </GlassBadge>
                    </div>
                    <div className="flex items-center justify-between text-xs text-white/60">
                      <span>
                        <CheckCircleIcon className="w-4 h-4 inline mr-1" />
                        {data.satisfied} satisfied
                      </span>
                      <span>
                        <ExclamationTriangleIcon className="w-4 h-4 inline mr-1" />
                        {data.unsatisfied} open
                      </span>
                    </div>
                    <div className="mt-2 h-2 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500 transition-all duration-300"
                        style={{ width: `${data.percentage}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </GlassCard>
          )}

          {/* Tasks & Alerts Panels */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Tasks Panel */}
            <GlassCard className="p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white">Compliance Tasks</h3>
                <span className="text-sm text-white/50">{tasks.length} open</span>
              </div>
              {tasks.length === 0 ? (
                <p className="text-white/40 text-sm py-4">No open tasks</p>
              ) : (
                <div className="space-y-3">
                  {tasks.slice(0, 5).map((task) => (
                    <div
                      key={task.id}
                      className="p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors cursor-pointer"
                      onClick={() => {
                        const req = requirements.find((r) => r.id === task.requirementId);
                        if (req) setSelectedRequirement(req);
                      }}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-sm font-medium text-white">{task.title}</p>
                          <p className="text-xs text-white/50 mt-1">{task.requirementTitle}</p>
                        </div>
                        {task.dueDate && (
                          <span className="text-xs text-white/40">{task.dueDate}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </GlassCard>

            {/* Alerts Panel */}
            <GlassCard className="p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white">Active Alerts</h3>
                <span className="text-sm text-white/50">{alerts.length} active</span>
              </div>
              {alerts.length === 0 ? (
                <p className="text-white/40 text-sm py-4">No active alerts</p>
              ) : (
                <div className="space-y-3">
                  {alerts.slice(0, 5).map((alert) => (
                    <div
                      key={alert.id}
                      className="p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors cursor-pointer"
                      onClick={() => {
                        if (alert.requirementId) {
                          const req = requirements.find((r) => r.id === alert.requirementId);
                          if (req) setSelectedRequirement(req);
                        }
                      }}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-lg ${
                          alert.severity === 'critical' ? 'bg-red-500/20' :
                          alert.severity === 'warning' ? 'bg-amber-500/20' :
                          'bg-blue-500/20'
                        }`}>
                          <BellAlertIcon className={`w-4 h-4 ${
                            alert.severity === 'critical' ? 'text-red-400' :
                            alert.severity === 'warning' ? 'text-amber-400' :
                            'text-blue-400'
                          }`} />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-white">{alert.title}</p>
                          {alert.message && (
                            <p className="text-xs text-white/50 mt-1 line-clamp-1">{alert.message}</p>
                          )}
                        </div>
                        <GlassBadge variant={
                          alert.severity === 'critical' ? 'danger' :
                          alert.severity === 'warning' ? 'warning' : 'info'
                        }>
                          {alert.severity}
                        </GlassBadge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </GlassCard>
          </div>

          {/* Quick Access Cards */}
          <GlassCard className="p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Quick Access</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <div
                className="p-4 rounded-lg bg-white/5 hover:bg-white/10 transition-colors cursor-pointer text-center"
                onClick={() => router.push('/grc/tax-history')}
              >
                <div className="p-3 rounded-xl bg-emerald-500/20 w-fit mx-auto mb-2">
                  <ScaleIcon className="w-6 h-6 text-emerald-400" />
                </div>
                <p className="text-sm font-medium text-white">Tax History</p>
                <p className="text-xs text-white/50 mt-1">Filings & payments</p>
              </div>

              <div
                className="p-4 rounded-lg bg-white/5 hover:bg-white/10 transition-colors cursor-pointer text-center"
                onClick={() => router.push('/grc/licenses')}
              >
                <div className="p-3 rounded-xl bg-blue-500/20 w-fit mx-auto mb-2">
                  <DocumentTextIcon className="w-6 h-6 text-blue-400" />
                </div>
                <p className="text-sm font-medium text-white">Licenses</p>
                <p className="text-xs text-white/50 mt-1">Permits & renewals</p>
              </div>

              <div
                className="p-4 rounded-lg bg-white/5 hover:bg-white/10 transition-colors cursor-pointer text-center"
                onClick={() => router.push('/grc/audit')}
              >
                <div className="p-3 rounded-xl bg-purple-500/20 w-fit mx-auto mb-2">
                  <ClipboardDocumentCheckIcon className="w-6 h-6 text-purple-400" />
                </div>
                <p className="text-sm font-medium text-white">Audit Log</p>
                <p className="text-xs text-white/50 mt-1">Compliance trail</p>
              </div>

              <div
                className="p-4 rounded-lg bg-white/5 hover:bg-white/10 transition-colors cursor-pointer text-center"
                onClick={() => router.push('/grc/calendar')}
              >
                <div className="p-3 rounded-xl bg-amber-500/20 w-fit mx-auto mb-2">
                  <CalendarIcon className="w-6 h-6 text-amber-400" />
                </div>
                <p className="text-sm font-medium text-white">Calendar</p>
                <p className="text-xs text-white/50 mt-1">Deadlines & events</p>
              </div>

              <div
                className="p-4 rounded-lg bg-white/5 hover:bg-white/10 transition-colors cursor-pointer text-center"
                onClick={() => router.push('/grc/documents')}
              >
                <div className="p-3 rounded-xl bg-cyan-500/20 w-fit mx-auto mb-2">
                  <DocumentTextIcon className="w-6 h-6 text-cyan-400" />
                </div>
                <p className="text-sm font-medium text-white">Documents</p>
                <p className="text-xs text-white/50 mt-1">All compliance docs</p>
              </div>

              <div
                className="p-4 rounded-lg bg-white/5 hover:bg-white/10 transition-colors cursor-pointer text-center"
                onClick={() => setShowProfileModal(true)}
              >
                <div className="p-3 rounded-xl bg-rose-500/20 w-fit mx-auto mb-2">
                  <BuildingLibraryIcon className="w-6 h-6 text-rose-400" />
                </div>
                <p className="text-sm font-medium text-white">Business Profile</p>
                <p className="text-xs text-white/50 mt-1">Update info</p>
              </div>
            </div>
          </GlassCard>
        </>
      )}

      {/* Empty state when no profile/analytics */}
      {!analytics && !loading && (
        <GlassCard className="p-8 text-center">
          <BuildingLibraryIcon className="w-12 h-12 text-white/30 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">Set Up Your Business Profile</h3>
          <p className="text-white/50 mb-4">
            Create your business profile to generate compliance requirements and start tracking.
          </p>
          <GlassButton variant="primary" onClick={() => setShowProfileModal(true)}>
            <SparklesIcon className="w-5 h-5 mr-2" />
            Get Started
          </GlassButton>
        </GlassCard>
      )}
    </div>
  );
}

export default function GRCPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-64">
          <Spinner size="lg" />
        </div>
      }
    >
      <GRCPageContent />
    </Suspense>
  );
}
