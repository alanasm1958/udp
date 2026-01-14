# Sales & Customers Module - Implementation Guide

## Quick Start

This guide provides a roadmap for implementing the completely remodeled Sales & Customers module for UDP.

---

## 📁 Documentation Structure

1. **sales-customers-remodel-spec.md** - Part 1: UX & Features
   - Module structure (3-tier dashboard)
   - Activity cards and forms (19 activities)
   - Wizards ("Analyze This Sale", "First Invoice")
   - Detailed form specifications

2. **sales-customers-remodel-spec-part2.md** - Part 2: Technical
   - Database schema (people, activities, health scoring)
   - API routes (activities, people, health, AI analysis)
   - Implementation phases (6 phases, 7 weeks)
   - Security, performance, testing

---

## 🎯 Core Concepts

### 1. Single Entry Point Philosophy
- **ONE button**: [+ Record Activity]
- Opens drawer with 19 activity cards
- Each card leads to appropriate form or wizard
- Eliminates scattered entry points

### 2. People-Centric Design
- Universal `people` table (one person, multiple roles)
- Person can be: customer, vendor, employee, contractor simultaneously
- Smart duplicate detection
- Conflict-of-interest warnings

### 3. Activity-Driven Workflows
- Every interaction is an "activity"
- Activities auto-generate todos and alerts
- Activities update health scores
- Activities create audit trail

### 4. SME-Friendly UX
- Tooltips on every field
- Wizards for complex tasks
- Plain language (not jargon)
- Contextual help sections
- Celebration for first-time achievements

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────┐
│         Sales & Customers Dashboard         │
├─────────────────────────────────────────────┤
│                                             │
│  TIER 1: Analytics (Revenue, Pipeline, AR) │
│  TIER 2: Todos & Alerts (Actionable Items) │
│  TIER 3: Quick Access (Recent Data)        │
│                                             │
│  [+ Record Activity] ──> Drawer with Cards  │
│                                             │
└─────────────────────────────────────────────┘
           │
           ├──> Activities DB ──> Todos/Alerts
           ├──> People DB ──> Relationships
           ├──> Health Scores ──> Risk Analysis
           └──> AI Analysis ──> Recommendations
```

---

## 🗄️ Database Changes Summary

### New Tables
```sql
people                    -- Universal people registry
person_relationships      -- One person, multiple roles
person_contact_methods    -- Multiple contact points
sales_activities          -- All interactions logged
customer_health_scores    -- Risk & engagement scoring
```

### Extended Tables
```sql
leads                     -- Add person_id, health_score
sales_docs               -- Add payment tracking
parties                  -- Add person_id link
```

### Key Functions
```sql
calculate_customer_health_score(tenant_id, customer_id)
  → Returns 0-100 score based on:
    - Payment reliability (30%)
    - Engagement frequency (20%)
    - Order frequency (20%)
    - Growth trend (15%)
    - Issue count (15%)
```

---

## 🔌 API Routes Summary

### Activity Recording
```
POST   /api/sales-customers/activities          - Create activity
GET    /api/sales-customers/activities          - List activities
GET    /api/sales-customers/activities/:id      - Get details
PATCH  /api/sales-customers/activities/:id      - Update
DELETE /api/sales-customers/activities/:id      - Delete
POST   /api/sales-customers/activities/bulk     - Bulk create
```

### People & Relationships
```
POST   /api/sales-customers/people              - Create person
GET    /api/sales-customers/people              - Search people
GET    /api/sales-customers/people/:id          - Get person + history
POST   /api/sales-customers/people/:id/relationships - Add role
```

### Health & Analytics
```
GET    /api/sales-customers/health              - List health scores
GET    /api/sales-customers/health/at-risk      - Get risky customers
POST   /api/sales-customers/health/:id/recalculate - Force recalc
GET    /api/sales-customers/analytics/dashboard - Dashboard data
GET    /api/sales-customers/analytics/funnel    - Conversion funnel
```

### AI Features
```
POST   /api/sales-customers/analyze-sale        - AI sale analysis
POST   /api/sales-customers/ai/suggest-next-action - AI suggestions
```

---

## 📋 Implementation Checklist

### Phase 1: Foundation (Week 1-2)
**Goal**: Database ready, basic API working

- [ ] Run migration to create new tables
- [ ] Migrate existing customer data to people table
- [ ] Create person_relationships for all customers
- [ ] Implement POST /api/sales-customers/people
- [ ] Implement POST /api/sales-customers/activities
- [ ] Test: Create person, create activity, verify DB

**Deliverable**: Can create people and log basic activities via API

---

### Phase 2: Activity Recording (Week 2-3)
**Goal**: Users can record all activity types

- [ ] Build drawer component with activity cards
- [ ] Implement Phone Call form
- [ ] Implement Meeting form
- [ ] Implement Customer Issue form
- [ ] Implement Payment Reminder form
- [ ] Wire up form → API → success actions
- [ ] Test: Record each activity type, verify todos/alerts created

**Deliverable**: Full activity recording system working

---

### Phase 3: Dashboard & Analytics (Week 3-4)
**Goal**: Dashboard shows live data

- [ ] Implement analytics calculations (revenue, pipeline, etc.)
- [ ] Build analytics cards component
- [ ] Build todos/alerts section
- [ ] Build quick access cards
- [ ] Implement GET /api/sales-customers/analytics/dashboard
- [ ] Wire up real-time data fetching
- [ ] Test: Dashboard loads in < 1s, shows accurate data

**Deliverable**: Complete dashboard with 3-tier layout

---

### Phase 4: Wizards & AI (Week 4-5)
**Goal**: Wizards guide users through complex tasks

- [ ] Build wizard framework (stepper, navigation, data flow)
- [ ] Implement "First Invoice" wizard (6 steps)
- [ ] Implement "Analyze Sale" wizard (5 steps)
- [ ] Integrate Anthropic API for AI analysis
- [ ] Implement AI prompts (customer, pricing, risk, action plan)
- [ ] Test: Complete both wizards end-to-end

**Deliverable**: AI-powered wizards working

---

### Phase 5: Health Scoring & Automation (Week 5-6)
**Goal**: System automatically monitors customer health

- [ ] Implement health score calculation function
- [ ] Set up triggers for score recalculation
- [ ] Implement automated todo creation rules
- [ ] Implement automated alert generation rules
- [ ] Set up daily batch jobs (score recalc, alert checks)
- [ ] Build at-risk customers dashboard
- [ ] Test: Scores update on events, alerts fire correctly

**Deliverable**: Automated health monitoring system

---

### Phase 6: Integration & Polish (Week 6-7)
**Goal**: Production-ready, polished UX

- [ ] Add tooltips to all form fields
- [ ] Implement loading states everywhere
- [ ] Add empty states with helpful CTAs
- [ ] Implement error boundaries and friendly error messages
- [ ] Test mobile responsiveness
- [ ] Write user documentation
- [ ] Create video tutorial for "First Invoice"
- [ ] Performance optimization (caching, lazy loading)
- [ ] Security audit (data access, encryption)
- [ ] Test: Full user acceptance testing with SME owners

**Deliverable**: Production-ready module

---

## 🎨 UI Components to Build

### New Components
```
<ActivityDrawer>                    - Main entry point
  <ActivityCard />                  - Individual activity cards
  <ActivityForm />                  - Dynamic form renderer
  
<SalesDashboard>                    - Main dashboard
  <AnalyticsSection>
    <AnalyticsCard />               - Revenue, pipeline, etc.
  </AnalyticsSection>
  <TodoAlertsSection>
    <TodoPanel />
    <AlertsPanel />
  </TodoAlertsSection>
  <QuickAccessSection>
    <QuickAccessCard />
  </QuickAccessSection>
  
<WizardWindow>                      - Wizard container
  <WizardStep />                    - Individual step
  <WizardNavigation />              - Prev/Next buttons
  <WizardProgress />                - Step indicator
  
<HealthScoreCard>                   - Customer health display
<ActivityTimeline>                  - Activity history view
<PersonCard>                        - Universal person display
```

---

## 🔧 Configuration Files

### Environment Variables
```bash
# AI Integration
ANTHROPIC_API_KEY=sk-ant-...

# Feature Flags
ENABLE_SALES_ACTIVITIES=true
ENABLE_HEALTH_SCORING=true
ENABLE_AI_ANALYSIS=true
ENABLE_FIRST_INVOICE_WIZARD=true
```

### Activity Rules Config
```typescript
// config/sales-activities.ts
export const ACTIVITY_TODO_RULES = {
  quote_sent: { dueInDays: 3, priority: "medium" },
  meeting_held: { dueInDays: 0, priority: "high" },
  // ... more rules
};

export const ACTIVITY_ALERT_RULES = {
  customer_issue_critical: { severity: "critical", assignTo: "manager" },
  // ... more rules
};
```

---

## 🧪 Testing Strategy

### Critical User Flows to Test

1. **First Invoice Creation**
   ```
   New user → Opens wizard → Enters customer → Adds items
   → Sets payment terms → Reviews → Sends → Sees celebration
   ```

2. **Log Customer Issue**
   ```
   User → Opens activity drawer → Selects "Log Issue"
   → Fills severity/details → Submits → Manager gets alert
   → Todo created for resolution
   ```

3. **Overdue Payment Flow**
   ```
   Invoice overdue → Alert fires → User sends reminder
   → Customer promises payment → Todo created for check date
   → Payment received → Invoice marked paid
   ```

4. **AI Sale Analysis**
   ```
   User → Opens wizard → Enters opportunity details
   → AI analyzes customer → AI suggests pricing
   → AI assesses risk → AI creates action plan
   → Todos created → Quote generated
   ```

### Performance Benchmarks
- Dashboard load: < 1 second
- Activity form open: < 200ms
- Activity submission: < 500ms
- Health score calculation: < 2 seconds
- AI analysis complete: < 30 seconds

---

## 📊 Success Criteria

### User Adoption
- ✅ 80% of users record at least 1 activity per week
- ✅ 50% of new users complete "First Invoice" wizard
- ✅ Average 5+ activities per user per week

### Business Impact
- ✅ 20% reduction in overdue invoices
- ✅ 50% increase in follow-up rate
- ✅ 10% reduction in days-to-payment
- ✅ 5% increase in customer retention

### UX Quality
- ✅ Time to first invoice: < 5 minutes
- ✅ Time to record activity: < 2 minutes
- ✅ Form abandonment rate: < 10%
- ✅ 95%+ positive user feedback

---

## 🚀 Deployment Steps

### Pre-Deployment
1. Run database migrations in staging
2. Migrate existing customer data
3. Calculate initial health scores
4. Test all API endpoints
5. Load test with production-like data
6. Security review completed
7. User acceptance testing passed

### Deployment
1. Deploy API changes (backward compatible)
2. Run database migrations in production
3. Migrate production customer data
4. Enable feature flags gradually:
   - Day 1: 10% of users
   - Day 3: 25% of users
   - Day 7: 50% of users
   - Day 14: 100% of users
5. Monitor error rates and performance
6. Gather user feedback
7. Iterate based on feedback

### Post-Deployment
1. Daily check: Error rates, performance metrics
2. Weekly: User adoption metrics
3. Monthly: Business impact metrics
4. Ongoing: User feedback → feature improvements

---

## 📚 Documentation Deliverables

### For Developers
- ✅ Complete API documentation (OpenAPI spec)
- ✅ Database schema documentation
- ✅ Component storybook
- ✅ Testing guide
- ✅ Deployment runbook

### For Users (SME Owners)
- [ ] "Getting Started with Sales & Customers"
- [ ] "How to Create Your First Invoice" (video)
- [ ] "Understanding Payment Terms"
- [ ] "Tracking Customer Health"
- [ ] "Using AI to Analyze Sales"
- [ ] FAQ document

---

## 🆘 Support & Troubleshooting

### Common Issues

**Issue**: Health score not updating
- Check if triggers are enabled
- Verify calculation function works: `SELECT calculate_customer_health_score(...)`
- Check background job logs

**Issue**: Todos not created after activity
- Verify `ACTIVITY_TODO_RULES` configuration
- Check actor permissions
- Review API response for errors

**Issue**: AI analysis timing out
- Check Anthropic API key valid
- Verify network connectivity
- Check if customer has sufficient history data
- Review AI timeout settings (default 30s)

**Issue**: Dashboard loading slowly
- Check analytics cache hit rate
- Verify database indexes exist
- Review slow query log
- Consider materialized views

---

## 📞 Support Contacts

**Technical Issues**: dev-team@udp.com
**User Experience**: ux-team@udp.com
**Business Questions**: product@udp.com
**Security Concerns**: security@udp.com

---

## 🎓 Training Resources

### For Implementation Team
- Weekly sync meetings during implementation
- Slack channel: #sales-customers-remodel
- Technical Q&A sessions: Fridays 3 PM
- Code review guidelines in `/docs/code-review.md`

### For End Users
- Onboarding video series (5 videos, 10 min each)
- Interactive tutorial in app (first-time user flow)
- Help center: https://help.udp.com/sales-customers
- Live chat support during business hours

---

## ✅ Go-Live Checklist

### Before Launch
- [ ] All Phase 1-6 deliverables complete
- [ ] Performance benchmarks met
- [ ] Security audit passed
- [ ] User acceptance testing complete
- [ ] Documentation published
- [ ] Training materials ready
- [ ] Support team trained
- [ ] Rollback plan documented

### Launch Day
- [ ] Deploy to production
- [ ] Run data migration
- [ ] Enable feature flags for 10%
- [ ] Monitor error rates (target: < 0.1%)
- [ ] Monitor performance (target: p95 < 500ms)
- [ ] Support team on standby
- [ ] Announcement sent to users

### Week 1 Post-Launch
- [ ] Daily error rate check
- [ ] User feedback collection
- [ ] Performance monitoring
- [ ] Gradual rollout to 100%
- [ ] Address critical issues
- [ ] Document lessons learned

---

*Implementation guide complete - ready to begin development!*

## Next Steps

1. **Review** these specifications with the team
2. **Estimate** effort for each phase
3. **Assign** team members to phases
4. **Begin** with Phase 1: Foundation
5. **Iterate** based on user feedback

Good luck! 🚀
