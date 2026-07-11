import multer from "multer";
import { Request, Response, NextFunction } from "express";
import { AppError } from "../utils/app-error";
import { settingService } from "../../modules/settings/setting.service";
import { SETTING_KEYS } from "../../modules/settings/setting.constants";

const DEFAULT_ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
];
const DEFAULT_MAX_SIZE_MB = 5;

const buildMulterInstance = () => {
  const allowed = settingService.getJSONSync<string[]>(
    SETTING_KEYS.UPLOADS_ALLOWED_MIME_TYPES,
    DEFAULT_ALLOWED_MIME_TYPES,
  );
  const maxSizeMb = settingService.getNumberSync(
    SETTING_KEYS.UPLOADS_MAX_FILE_SIZE_MB,
    DEFAULT_MAX_SIZE_MB,
  );

  return multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: maxSizeMb * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      if (!allowed.includes(file.mimetype)) {
        return cb(new AppError(`Only ${allowed.join(", ")} are allowed`, 400));
      }
      cb(null, true);
    },
  });
};

// Chaque appel reconstruit l'instance multer à partir des settings à jour —
// contrairement à un multer() instancié une fois à l'import, ceci garantit
// que modifier uploads.max_file_size_mb / uploads.allowed_mime_types depuis
// PATCH /settings prend effet immédiatement, sans redémarrage serveur.
export const upload = {
  single:
    (fieldName: string) => (req: Request, res: Response, next: NextFunction) =>
      buildMulterInstance().single(fieldName)(req, res, next),

  array:
    (fieldName: string, maxCount?: number) =>
    (req: Request, res: Response, next: NextFunction) =>
      buildMulterInstance().array(fieldName, maxCount)(req, res, next),

  fields:
    (fields: { name: string; maxCount?: number }[]) =>
    (req: Request, res: Response, next: NextFunction) =>
      buildMulterInstance().fields(fields)(req, res, next),
};
