/**
 * Sales domain schema - re-exports sales-related tables from the main schema.
 *
 * Includes: Sales Documents, Lines, Fulfillments, Posting Links.
 */
export {
  // Sales Documents
  salesDocs,
  salesDocLines,
  salesFulfillments,
  salesPostingLinks,
} from "../schema";
