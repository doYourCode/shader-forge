import type {
  AddUserUniformResult,
  UserDataCommandResult,
  UserDataController,
  UserUniformInit,
} from '@/services/userdata/UserDataController';
import type {
  NameValidationResult,
  UserDataDocument,
  UserUniformKind,
  UserUniformStage,
  UserUniformValue,
} from '@/core/models/userUniform';

/**
 * The command surface the User data panel drives. It is a thin, typed view of
 * `UserDataController` so the editor coordinator never talks to the document
 * directly, and the panel contract can be tested without the controller.
 */
export interface UserDataCommands {
  readonly doc: UserDataDocument;
  replaceAll(uniforms: readonly UserUniformInit[]): void;
  add(request: {
    name: string;
    kind: UserUniformKind;
    stages?: UserUniformStage;
  }): AddUserUniformResult;
  remove(id: string): UserDataCommandResult;
  rename(id: string, name: string): UserDataCommandResult;
  changeKind(id: string, kind: UserUniformKind): UserDataCommandResult;
  changeStages(id: string, stages: UserUniformStage): UserDataCommandResult;
  setValue(id: string, value: UserUniformValue): UserDataCommandResult;
  validateName(name: string, exceptId?: string): NameValidationResult;
}

export function useUserDataCommands<TTexture>(
  userData: UserDataController<TTexture>,
): UserDataCommands {
  return {
    doc: userData.doc,
    replaceAll: (uniforms) => userData.replaceAll(uniforms),
    add: (request) => userData.add(request),
    remove: (id) => userData.remove(id),
    rename: (id, name) => userData.rename(id, name),
    changeKind: (id, kind) => userData.changeKind(id, kind),
    changeStages: (id, stages) => userData.changeStages(id, stages),
    setValue: (id, value) => userData.setValue(id, value),
    validateName: (name, exceptId) => userData.validateName(name, exceptId),
  };
}
