/**
 * Services domain schema - re-exports service fulfillment tables from the main schema.
 *
 * Includes: Service Jobs, Assignments, Events.
 */
export {
  // Service Jobs
  serviceJobs,
  serviceJobAssignments,
  serviceJobEvents,
  // Enums
  serviceJobStatus,
} from "../schema";
