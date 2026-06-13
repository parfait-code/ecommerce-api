export const paginate = (query: { page?: string; limit?: string }) => ({
  skip: (Number(query.page ?? 1) - 1) * Number(query.limit ?? 20),
  take: Number(query.limit ?? 20),
})