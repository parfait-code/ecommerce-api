export { eventBus } from "./event-bus";
export * from "./event-types";

import { registerPaymentEventListeners } from "./listeners/payment.listeners";
import { registerReturnEventListeners } from "./listeners/return.listeners";
import { registerShipmentEventListeners } from "./listeners/shipment.listeners";

/**
 * Point d'entrée unique pour enregistrer TOUS les listeners de l'application.
 * Appelé une seule fois au démarrage (voir src/app.ts).
 *
 * ⚠️ Important : ce fichier importe les listeners, qui importent des services
 * métier (order.service, payment.service, ...). Les services métier ne
 * doivent JAMAIS importer depuis ce fichier index.ts — ils doivent importer
 * directement depuis './event-bus' et './event-types' pour éviter les
 * dépendances circulaires.
 */
export const registerEventListeners = (): void => {
  registerPaymentEventListeners();
  registerReturnEventListeners();
  registerShipmentEventListeners();
};
