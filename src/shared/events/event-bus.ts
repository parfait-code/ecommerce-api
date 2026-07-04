import { EventEmitter } from "events";
import { AppEventMap } from "./event-types";
import { systemLogger } from "../logger";

/**
 * Event Bus interne (in-process)
 * ================================
 * Bus d'événements typé, basé sur Node's EventEmitter, utilisé pour découpler
 * les domaines métier (orders, payments, shipments, returns, inventory, ...)
 * qui doivent réagir aux changements d'état les uns des autres SANS s'importer
 * directement entre eux.
 *
 * Principe : un service émet un fait ("le statut de X est passé de A à B"),
 * sans savoir qui écoute ni ce qui va se passer ensuite. Les listeners
 * (dans src/shared/events/listeners/*) contiennent la logique de réaction.
 *
 * Voir src/shared/events/README.md pour la documentation complète
 * (catalogue d'événements, conventions, gestion des erreurs).
 */

type EventName = keyof AppEventMap;

class TypedEventBus {
  private emitter = new EventEmitter();

  constructor() {
    // Le max par défaut de Node est 10 listeners par événement — on l'augmente
    // car plusieurs domaines indépendants peuvent écouter le même événement
    // (ex: "order.status.changed" est écouté par payment.listeners.ts,
    // et pourra l'être par loyalty.listeners.ts, notification.listeners.ts, etc.)
    this.emitter.setMaxListeners(50);
  }

  /**
   * Enregistre un listener pour un événement donné.
   * Les erreurs (synchrones ou dans une Promise rejetée) sont toujours
   * capturées et loguées — un listener qui échoue NE DOIT JAMAIS faire
   * planter le code qui a émis l'événement, ni être avalé silencieusement.
   */
  on<E extends EventName>(
    event: E,
    listener: (payload: AppEventMap[E]) => void | Promise<void>,
  ): void {
    this.emitter.on(event, (payload: AppEventMap[E]) => {
      try {
        const result = listener(payload);
        if (result instanceof Promise) {
          result.catch((err) => this.logListenerError(event, payload, err));
        }
      } catch (err) {
        this.logListenerError(event, payload, err);
      }
    });
  }

  /**
   * Émet un événement. Fire-and-forget : n'attend pas les listeners.
   * L'émetteur n'a jamais à se soucier de ce que font les listeners.
   */
  emit<E extends EventName>(event: E, payload: AppEventMap[E]): void {
    this.emitter.emit(event, payload);
  }

  private logListenerError(
    event: EventName,
    payload: unknown,
    err: unknown,
  ): void {
    systemLogger.error("EVENT_LISTENER_FAILED", {
      service: "event-bus",
      metadata: {
        event,
        payload,
        error: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
      },
    });
  }
}

export const eventBus = new TypedEventBus();
