import { UserRepository } from './UserRepository.js'

/**
 * Backward-compatible alias mapping AccountRepository directly to UserRepository
 * under the unified 1:1 user/account architecture.
 */
export const AccountRepository = {
  ...UserRepository,
  setDefault: async () => {
    // No-op under 1:1 user/account model (each user operates on their single account)
  }
}
