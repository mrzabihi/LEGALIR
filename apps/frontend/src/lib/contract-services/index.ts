// ============================================================
// LEGALIR — Contract Services (barrel)
// ============================================================
// The single import surface for the /contracts catalog data. Everything
// the catalog page and the service detail route render comes from here.
// ============================================================

export {
  CONTRACT_SERVICES,
  CONTRACT_CATEGORIES,
  CONTRACT_SERVICE_COUNT,
  CONTRACT_SERVICE_STATUS_FA,
  CONTRACT_SERVICE_STATUS_LONG_FA,
  POPULAR_CONTRACT_SERVICE_IDS,
  contractServiceHref,
  contractServicesByCategory,
  findContractServices,
  getContractCategory,
  getContractService,
  populatedContractCategories,
  popularContractServices,
  searchContractServices,
  type ContractCategory,
  type ContractCategoryId,
  type ContractService,
  type ContractServiceStatus,
  type IconComponent,
  type LawyerSpecialtyCode,
} from "./catalog";
