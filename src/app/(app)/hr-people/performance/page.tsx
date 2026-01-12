"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { GlassCard, GlassButton, GlassInput, EmptyState, useToast } from "@/components/ui/glass";
import { Award, ArrowLeft, Search, Lock, LockOpen, Check, Star } from "lucide-react";

interface PerformanceReview {
  id: string;
  personId: string;
  personName: string;
  reviewerId: string | null;
  reviewerName: string | null;
  reviewPeriodStart: string;
  reviewPeriodEnd: string;
  reviewDate: string;
  overallRating: string | null;
  status: string;
  reviewerAccepted: boolean;
  employeeAccepted: boolean;
  isLocked: boolean;
  createdAt: string;
}

export default function PerformanceReviewsPage() {
  const router = useRouter();
  const { addToast } = useToast();
  const [reviews, setReviews] = useState<PerformanceReview[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    loadReviews();
  }, []);

  const loadReviews = async () => {
    try {
      setIsLoading(true);
      const res = await fetch("/api/hr-people/performance");
      if (res.ok) {
        const data = await res.json();
        setReviews(data.reviews || []);
      }
    } catch (error) {
      console.error("Error loading reviews:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAccept = async (reviewId: string, role: "reviewer" | "employee") => {
    try {
      const res = await fetch(`/api/hr-people/performance/${reviewId}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });

      if (res.ok) {
        addToast("success", `${role === "reviewer" ? "Reviewer" : "Employee"} acceptance recorded`);
        loadReviews();
      } else {
        const error = await res.json();
        addToast("error", error.error || "Failed to accept review");
      }
    } catch (error) {
      console.error("Error accepting review:", error);
      addToast("error", "Failed to accept review");
    }
  };

  const filteredReviews = reviews.filter(
    (r) =>
      r.personName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.reviewerName && r.reviewerName.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case "draft":
        return "bg-gray-500/20 text-gray-400";
      case "in_progress":
        return "bg-blue-500/20 text-blue-400";
      case "completed":
        return "bg-green-500/20 text-green-400";
      default:
        return "bg-white/20 text-white/60";
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const renderRatingStars = (rating: string | null) => {
    if (!rating) return <span className="text-white/40">Not rated</span>;
    const numRating = parseInt(rating);
    return (
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`w-4 h-4 ${
              star <= numRating ? "text-yellow-400 fill-yellow-400" : "text-white/20"
            }`}
          />
        ))}
      </div>
    );
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
            <h1 className="text-3xl font-bold">Performance Reviews</h1>
            <p className="text-white/60">Manage employee performance reviews</p>
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
            placeholder="Search by employee or reviewer name..."
            className="pl-10"
          />
        </div>
      </div>

      {/* Reviews List */}
      <GlassCard>
        {isLoading ? (
          <div className="p-8 text-center">
            <div className="animate-spin w-8 h-8 border-2 border-white/20 border-t-white/60 rounded-full mx-auto" />
            <p className="text-white/40 mt-4">Loading reviews...</p>
          </div>
        ) : filteredReviews.length === 0 ? (
          <EmptyState
            icon={<Award className="w-6 h-6" />}
            title={searchQuery ? "No results found" : "No performance reviews yet"}
            description={
              searchQuery
                ? "Try a different search term"
                : "Create your first performance review using the Record Activity button"
            }
          />
        ) : (
          <div className="divide-y divide-white/10">
            {filteredReviews.map((review) => (
              <div key={review.id} className="p-6 hover:bg-white/5 transition-colors">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold">{review.personName}</h3>
                      <span className={`text-xs px-2 py-1 rounded ${getStatusColor(review.status)}`}>
                        {review.status.replace(/_/g, " ")}
                      </span>
                      {review.isLocked ? (
                        <Lock className="w-4 h-4 text-green-400" />
                      ) : (
                        <LockOpen className="w-4 h-4 text-white/40" />
                      )}
                    </div>
                    <div className="text-sm text-white/60 space-y-1">
                      <p>
                        Period: {formatDate(review.reviewPeriodStart)} -{" "}
                        {formatDate(review.reviewPeriodEnd)}
                      </p>
                      {review.reviewerName && <p>Reviewer: {review.reviewerName}</p>}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-white/40 mb-1">Rating</p>
                    {renderRatingStars(review.overallRating)}
                  </div>
                </div>

                {/* Acceptance Status */}
                <div className="mt-4 pt-4 border-t border-white/10">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-6">
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-6 h-6 rounded-full flex items-center justify-center ${
                            review.reviewerAccepted ? "bg-green-500/20" : "bg-white/10"
                          }`}
                        >
                          {review.reviewerAccepted ? (
                            <Check className="w-4 h-4 text-green-400" />
                          ) : (
                            <span className="w-2 h-2 rounded-full bg-white/20" />
                          )}
                        </div>
                        <span className="text-sm text-white/60">
                          Reviewer {review.reviewerAccepted ? "accepted" : "pending"}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-6 h-6 rounded-full flex items-center justify-center ${
                            review.employeeAccepted ? "bg-green-500/20" : "bg-white/10"
                          }`}
                        >
                          {review.employeeAccepted ? (
                            <Check className="w-4 h-4 text-green-400" />
                          ) : (
                            <span className="w-2 h-2 rounded-full bg-white/20" />
                          )}
                        </div>
                        <span className="text-sm text-white/60">
                          Employee {review.employeeAccepted ? "accepted" : "pending"}
                        </span>
                      </div>
                    </div>

                    {!review.isLocked && (
                      <div className="flex gap-2">
                        {!review.reviewerAccepted && (
                          <GlassButton
                            onClick={() => handleAccept(review.id, "reviewer")}
                            variant="ghost"
                            size="sm"
                          >
                            Accept as Reviewer
                          </GlassButton>
                        )}
                        {!review.employeeAccepted && (
                          <GlassButton
                            onClick={() => handleAccept(review.id, "employee")}
                            variant="ghost"
                            size="sm"
                          >
                            Accept as Employee
                          </GlassButton>
                        )}
                      </div>
                    )}
                  </div>

                  {review.isLocked && (
                    <p className="text-sm text-green-400 mt-2 flex items-center gap-2">
                      <Lock className="w-4 h-4" />
                      This review is locked - both parties have accepted
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </GlassCard>
    </div>
  );
}
