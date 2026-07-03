11. Référence API — combinaisons produit & stock multi-entrepôt
    Attributs & sélection (admin)
    PUT /product/:productId/combinations/selections/:attributeDefinitionId
    Body: { "optionIds": ["opt_id_1", "opt_id_2"] }
    → Définit les valeurs disponibles pour CE produit sur UN attribut de variante
    (ex: pour le produit "T-shirt Basic", tailles disponibles = [M, L, XL])

GET /product/:productId/combinations/selections
→ Liste toutes les sélections actuelles du produit, par attribut

POST /product/:productId/combinations/generate
→ Génère le produit cartésien de toutes les sélections (crée les combinaisons
manquantes, réactive celles qui correspondent encore, désactive les autres)
Réponse : liste des combinaisons (actives et inactives)

PATCH /product/:productId/combinations/:combinationId
Body: { "sku"?: string, "price"?: number, "isActive"?: boolean }
→ Ex: désactiver manuellement "M + Rouge" si cette combinaison n'existe pas réellement

DELETE /product/:productId/combinations/:combinationId
→ 400 si de l'inventaire existe encore dessus (vider le stock d'abord)
Consultation (public/client)
GET /product/:productId/combinations
→ [{ id, optionsKey, sku, price, isActive,
values: [{ attributeDefinition: {name}, attributeOption: {value, colorHex} }],
inventory: [{ quantity, warehouseId }] }]

GET /product/:productId/combinations/:combinationId
→ Détail d'une combinaison précise
Panier / commande / wishlist — combination_id remplace variant_id
POST /basket/:basket_id/product
Body: { "product_id": 12, "combination_id"?: "cmb_xxx", "quantity": 2 }

POST /orders
Body: {
"items": [{ "id": "12", "combinationId"?: "cmb_xxx", "quantity": 2 }],
// OU "basketId": "basket_xxx" à la place de items
"shippingAddress": {...}, "couponCode"?: "PROMO10"
}
Format de retour OrderItem (dans GET /orders/:orderId et création)
json{
"productId": 12,
"combinationId": "cmb_xxx",
"combinationSnapshot": { "Taille": "M", "Couleur": "Orange" },
"quantity": 2,
"price": 4500,
"originalPrice": 5000,
"discountAmount": 1000,
"combination": {
"id": "cmb_xxx", "sku": "TSH-M-ORANGE", "price": 4500,
"values": [
{ "attributeDefinition": { "name": "Taille" }, "attributeOption": { "value": "M" } },
{ "attributeDefinition": { "name": "Couleur" }, "attributeOption": { "value": "Orange" } }
]
},
"reviews": []
}
combinationSnapshot reste correct même si l'attribut ou l'option est renommé/supprimé plus tard — l'historique de commande n'est jamais impacté.
Logique de stock (nouveau comportement)

Vérification à la commande : SUM(quantity) sur tous les entrepôts pour (productId, combinationId) ≥ quantité demandée. On ne bloque plus si un seul entrepôt est insuffisant.
Réservation à la validation : décrément FIFO — on épuise l'entrepôt le plus anciennement approvisionné pour ce produit/combinaison avant de passer au suivant, jusqu'à couvrir la quantité totale.
Annulation (DELETE /orders/:orderId ou passage de statut à CANCELLED) : restitution exacte, entrepôt par entrepôt, via la table OrderItemReservation qui trace qui a donné quoi.
Erreur 400 si le stock total est insuffisant à la vérification ; erreur 409 dans le cas rare où le stock a été pris entre la vérification et la réservation (la commande est alors annulée/supprimée automatiquement, rien n'est laissé en état incohérent).

Cas d'usage concret

Produit "T-shirt Basic" (catégorie "t-shirt", attributs Taille + Couleur, tous deux isVariant: true).
Admin sélectionne pour ce produit : Taille = [S, M, L], Couleur = [Rouge, Bleu].
POST /combinations/generate → crée 6 combinaisons (S-Rouge, S-Bleu, M-Rouge, M-Bleu, L-Rouge, L-Bleu), toutes actives.
Admin désactive "S-Bleu" (n'existe pas en réalité) → PATCH .../combinations/cmb_s_bleu { isActive: false }.
Stock ajouté : M-Rouge → 10 unités entrepôt Douala + 5 unités entrepôt Yaoundé (2 lignes Inventory).
Client commande 12 unités de M-Rouge → vérif : 10+5=15 ≥ 12 ✅ → réservation FIFO : 10 prises à Douala (créé le premier), 2 prises à Yaoundé.
Client annule → 10 unités rendues à Douala, 2 à Yaoundé, exactement comme prélevé.
