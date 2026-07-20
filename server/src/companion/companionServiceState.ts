import type { MemberPreferences, MemoryConfirmation } from "./companionSchemas.js";
import type { CompanionRepository } from "./companionRepository.js";
import type { CompanionStateRepository } from "./companionStateRepository.js";

export function createCompanionStateOperations(input: {
  repository: CompanionRepository;
  stateRepository: CompanionStateRepository;
}) {
  const { repository, stateRepository } = input;

  async function getState(spaceId: string, accountId: string) {
    const [member, bond] = await Promise.all([
      stateRepository.getMemberState(spaceId, accountId),
      stateRepository.getBondState(spaceId)
    ]);
    return { member, bond };
  }

  return {
    listMessages(spaceId: string, limit: number, cursor: string | null) {
      return repository.listMessagePage(spaceId, limit, cursor);
    },

    listMemories(spaceId: string) {
      return repository.listMemories(spaceId);
    },

    async saveMemory(spaceId: string, accountId: string, proposal: MemoryConfirmation) {
      const memory = await repository.saveMemory(spaceId, accountId, proposal);
      await stateRepository.awardBond(spaceId, `memory:${memory.id}`, 3);
      return memory;
    },

    deleteMemory(spaceId: string, memoryId: string) {
      return repository.deleteMemory(spaceId, memoryId);
    },

    async clearMessages(spaceId: string) {
      await repository.clearMessages(spaceId);
      await stateRepository.clearConversationSummary(spaceId);
    },

    getState,

    async updateState(spaceId: string, accountId: string, preferences: MemberPreferences) {
      await stateRepository.updateMemberPreferences(spaceId, accountId, preferences);
      return getState(spaceId, accountId);
    }
  };
}
