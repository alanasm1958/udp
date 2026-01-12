"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { GlassCard, GlassButton, GlassInput, GlassTable, PageHeader, EmptyState } from "@/components/ui/glass";
import { Users, ArrowLeft, Search, Mail, Phone, Briefcase } from "lucide-react";

interface Person {
  id: string;
  fullName: string;
  preferredName: string | null;
  email: string | null;
  phone: string | null;
  employmentType: string;
  jobTitle: string | null;
  department: string | null;
  status: string;
  hireDate: string | null;
  createdAt: string;
}

export default function PersonsPage() {
  const router = useRouter();
  const [persons, setPersons] = useState<Person[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    loadPersons();
  }, []);

  const loadPersons = async () => {
    try {
      setIsLoading(true);
      const res = await fetch("/api/hr-people/persons");
      if (res.ok) {
        const data = await res.json();
        setPersons(data.persons || []);
      }
    } catch (error) {
      console.error("Error loading persons:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredPersons = persons.filter(
    (p) =>
      p.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.email && p.email.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (p.jobTitle && p.jobTitle.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-500/20 text-green-400";
      case "on_leave":
        return "bg-yellow-500/20 text-yellow-400";
      case "terminated":
        return "bg-red-500/20 text-red-400";
      default:
        return "bg-white/20 text-white/60";
    }
  };

  const getEmploymentTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      staff: "Full-time",
      intern: "Intern",
      part_time: "Part-time",
      contractor: "Contractor",
      consultant: "Consultant",
      other: "Other",
    };
    return labels[type] || type;
  };

  return (
    <div className="min-h-screen p-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <GlassButton onClick={() => router.push("/hr-people")} variant="ghost" size="sm">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </GlassButton>
          <div>
            <h1 className="text-3xl font-bold">Persons</h1>
            <p className="text-white/60">All people in your organization</p>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="flex gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-white/40" />
          <GlassInput
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, email, or job title..."
            className="pl-10"
          />
        </div>
      </div>

      {/* Persons List */}
      <GlassCard>
        {isLoading ? (
          <div className="p-8 text-center">
            <div className="animate-spin w-8 h-8 border-2 border-white/20 border-t-white/60 rounded-full mx-auto" />
            <p className="text-white/40 mt-4">Loading persons...</p>
          </div>
        ) : filteredPersons.length === 0 ? (
          <EmptyState
            icon={<Users className="w-6 h-6" />}
            title={searchQuery ? "No results found" : "No persons yet"}
            description={
              searchQuery
                ? "Try a different search term"
                : "Add your first person using the Record Activity button on the HR & People page"
            }
          />
        ) : (
          <div className="divide-y divide-white/10">
            {filteredPersons.map((person) => (
              <div
                key={person.id}
                className="p-6 hover:bg-white/5 transition-colors cursor-pointer"
                onClick={() => {
                  // Could navigate to person detail page
                }}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center text-lg font-semibold">
                      {person.fullName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold">
                        {person.fullName}
                        {person.preferredName && (
                          <span className="text-white/40 text-sm ml-2">
                            ({person.preferredName})
                          </span>
                        )}
                      </h3>
                      <div className="flex items-center gap-4 mt-1 text-sm text-white/60">
                        {person.jobTitle && (
                          <span className="flex items-center gap-1">
                            <Briefcase className="w-4 h-4" />
                            {person.jobTitle}
                          </span>
                        )}
                        {person.department && (
                          <span className="text-white/40">{person.department}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 mt-2 text-sm text-white/40">
                        {person.email && (
                          <span className="flex items-center gap-1">
                            <Mail className="w-4 h-4" />
                            {person.email}
                          </span>
                        )}
                        {person.phone && (
                          <span className="flex items-center gap-1">
                            <Phone className="w-4 h-4" />
                            {person.phone}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-white/40">
                      {getEmploymentTypeLabel(person.employmentType)}
                    </span>
                    <span className={`text-xs px-2 py-1 rounded ${getStatusColor(person.status)}`}>
                      {person.status.replace("_", " ")}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </GlassCard>
    </div>
  );
}
