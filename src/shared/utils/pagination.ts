import { settingService } from "../../modules/settings/setting.service";
import { SETTING_KEYS } from "../../modules/settings/setting.constants";

export const paginate = (query: { page?: string; limit?: string }) => {
  const defaultLimit = settingService.getNumberSync(
    SETTING_KEYS.PAGINATION_DEFAULT_PAGE_SIZE,
    20,
  );
  const limit = Number(query.limit ?? defaultLimit);
  const page = Number(query.page ?? 1);
  return {
    skip: (page - 1) * limit,
    take: limit,
  };
};
