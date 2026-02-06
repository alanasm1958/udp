/**
 * People domain schema - re-exports people-related tables from the main schema.
 *
 * Includes: Unified People Directory, Service Providers, Addresses.
 */
export {
  // People Directory
  people,
  serviceProviders,
  peopleAddresses,
  // Enums
  personType,
  contactChannel,
  // Types
  type PeopleAddress,
  type NewPeopleAddress,
} from "../schema";
