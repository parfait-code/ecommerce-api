export { eventBus } from "./event-bus";
export * from "./event-types";

import { registerPaymentEventListeners } from "./listeners/payment.listeners";
import { registerReturnEventListeners } from "./listeners/return.listeners";
import { registerShipmentEventListeners } from "./listeners/shipment.listeners";
import { registerInventoryEventListeners } from "./listeners/inventory.listeners";
import { registerCombinationEventListeners } from "./listeners/combination.listeners";
import { registerProductEventListeners } from "./listeners/product.listeners";

export const registerEventListeners = (): void => {
  registerPaymentEventListeners();
  registerReturnEventListeners();
  registerShipmentEventListeners();
  registerInventoryEventListeners();
  registerCombinationEventListeners();
  registerProductEventListeners();
};
