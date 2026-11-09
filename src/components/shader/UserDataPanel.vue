<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { USER_UNIFORM_KINDS } from '@/core/constants/userUniformKinds';
import type {
  NameValidationReason,
  NameValidationResult,
  UserUniformDefinition,
  UserUniformKind,
  UserUniformStage,
  UserUniformValue,
} from '@/core/models/userUniform';
import { generateBlock } from '@/core/shader/uniformCodegen';
import UniformValueInput from './UniformValueInput.vue';

const props = defineProps<{
  definitions: readonly UserUniformDefinition[];
  /** Row index of the definition blamed by the latest user-data diagnostic. */
  highlightedRow: number | null;
  /** Injected so the table can reject names before any GPU work happens. */
  validateName: (name: string, exceptId?: string) => NameValidationResult;
}>();

const emit = defineEmits<{
  (e: 'add', request: { name: string; kind: UserUniformKind }): void;
  (e: 'remove', id: string): void;
  (e: 'rename', id: string, name: string): void;
  (e: 'change-kind', id: string, kind: UserUniformKind): void;
  (e: 'change-stages', id: string, stages: UserUniformStage): void;
  (e: 'change-value', id: string, value: UserUniformValue): void;
}>();

const { t } = useI18n();

const drafts = reactive<Record<string, string>>({});
const rowErrors = reactive<Record<string, string | null>>({});

const newName = ref('');
const newKind = ref<UserUniformKind>('float');
const addError = ref<string | null>(null);

const STAGES: readonly UserUniformStage[] = ['fragment', 'vertex', 'both'];

/** Stages whose generated block is previewed, in display order. */
const PREVIEW_STAGES = ['fragment', 'vertex'] as const;

/**
 * Read-only projection of the same block the compile pipeline injects. It is
 * derived from the table's definitions, so it is always in sync with what a
 * recompile would produce (including the values comment).
 */
const generatedBlocks = computed(() =>
  PREVIEW_STAGES.flatMap((stage) => {
    const block = generateBlock(
      { revision: 0, definitions: [...props.definitions] },
      stage,
    );

    return block ? [{ stage, lines: block.lines }] : [];
  }),
);

// Keep the editable drafts in sync with external renames (and drop rows that
// disappeared), without clobbering what the user is currently typing.
watch(
  () => props.definitions.map((definition) => definition.id).join('\u0000'),
  () => {
    for (const definition of props.definitions) {
      if (!(definition.id in drafts)) drafts[definition.id] = definition.name;
    }
    for (const id of Object.keys(drafts)) {
      if (!props.definitions.some((definition) => definition.id === id)) {
        delete drafts[id];
        delete rowErrors[id];
      }
    }
  },
  { immediate: true },
);

function draftFor(definition: UserUniformDefinition): string {
  return drafts[definition.id] ?? definition.name;
}

function errorMessage(reason: NameValidationReason): string {
  return t(`userData.error.${reason}`);
}

function onNameInput(definition: UserUniformDefinition, event: Event): void {
  drafts[definition.id] = (event.target as HTMLInputElement).value;
}

function commitRename(definition: UserUniformDefinition): void {
  const next = draftFor(definition).trim();

  if (next === definition.name) {
    drafts[definition.id] = definition.name;
    rowErrors[definition.id] = null;
    return;
  }

  const validation = props.validateName(next, definition.id);
  if (!validation.ok) {
    rowErrors[definition.id] = errorMessage(validation.reason);
    drafts[definition.id] = definition.name;
    return;
  }

  rowErrors[definition.id] = null;
  drafts[definition.id] = next;
  emit('rename', definition.id, next);
}

function onKindChange(definition: UserUniformDefinition, event: Event): void {
  const kind = (event.target as HTMLSelectElement).value as UserUniformKind;
  if (kind !== definition.kind) emit('change-kind', definition.id, kind);
}

function onStagesChange(
  definition: UserUniformDefinition,
  event: Event,
): void {
  const stages = (event.target as HTMLSelectElement).value as UserUniformStage;
  if (stages !== definition.stages) {
    emit('change-stages', definition.id, stages);
  }
}

function onValueChange(id: string, value: UserUniformValue): void {
  emit('change-value', id, value);
}

function submitAdd(): void {
  const name = newName.value.trim();
  const validation = props.validateName(name);

  if (!validation.ok) {
    addError.value = errorMessage(validation.reason);
    return;
  }

  addError.value = null;
  emit('add', { name, kind: newKind.value });
  newName.value = '';
}

function onNewKindChange(event: Event): void {
  newKind.value = (event.target as HTMLSelectElement).value as UserUniformKind;
}
</script>

<template>
  <section class="user-data" :aria-label="t('userData.title')">
    <header class="user-data__header">
      <div class="user-data__heading">
        <h2 class="user-data__title">{{ t('userData.title') }}</h2>
        <p class="user-data__description">{{ t('userData.description') }}</p>
      </div>
    </header>

    <form class="user-data__add" @submit.prevent="submitAdd">
      <h3 class="user-data__add-title">{{ t('userData.addHeading') }}</h3>
      <input
        v-model="newName"
        class="user-data__new-name"
        type="text"
        spellcheck="false"
        autocomplete="off"
        :placeholder="t('userData.namePlaceholder')"
        :aria-label="t('userData.columns.name')"
      />
      <select
        class="user-data__new-kind"
        :value="newKind"
        :aria-label="t('userData.columns.kind')"
        @change="onNewKindChange"
      >
        <option
          v-for="meta in USER_UNIFORM_KINDS"
          :key="meta.kind"
          :value="meta.kind"
        >
          {{ t(meta.labelKey) }}
        </option>
      </select>
      <button type="submit" class="user-data__add-button">
        {{ t('userData.add') }}
      </button>
      <span v-if="addError" class="user-data__add-error" role="alert">
        {{ addError }}
      </span>
    </form>

    <p v-if="props.definitions.length === 0" class="user-data__empty">
      {{ t('userData.empty') }}
    </p>

    <table v-else class="user-data__table">
      <thead>
        <tr>
          <th scope="col">{{ t('userData.columns.name') }}</th>
          <th scope="col">{{ t('userData.columns.kind') }}</th>
          <th scope="col">{{ t('userData.columns.stages') }}</th>
          <th scope="col">{{ t('userData.columns.value') }}</th>
          <th scope="col" class="user-data__actions-heading">
            {{ t('userData.columns.actions') }}
          </th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="(definition, row) in props.definitions"
          :key="definition.id"
          class="user-data__row"
          :class="{
            'user-data__row--highlighted': row === props.highlightedRow,
          }"
          :data-row="row"
          :data-uniform-id="definition.id"
        >
          <td class="user-data__cell user-data__cell--name">
            <input
              class="user-data__name"
              type="text"
              spellcheck="false"
              autocomplete="off"
              :value="draftFor(definition)"
              :aria-label="t('userData.columns.name')"
              @input="onNameInput(definition, $event)"
              @blur="commitRename(definition)"
              @keydown.enter.prevent="commitRename(definition)"
            />
            <span
              v-if="rowErrors[definition.id]"
              class="user-data__row-error"
              role="alert"
            >
              {{ rowErrors[definition.id] }}
            </span>
          </td>

          <td class="user-data__cell">
            <select
              class="user-data__kind"
              :value="definition.kind"
              :aria-label="t('userData.columns.kind')"
              @change="onKindChange(definition, $event)"
            >
              <option
                v-for="meta in USER_UNIFORM_KINDS"
                :key="meta.kind"
                :value="meta.kind"
              >
                {{ t(meta.labelKey) }}
              </option>
            </select>
          </td>

          <td class="user-data__cell">
            <select
              class="user-data__stages"
              :value="definition.stages"
              :aria-label="t('userData.columns.stages')"
              @change="onStagesChange(definition, $event)"
            >
              <option v-for="stage in STAGES" :key="stage" :value="stage">
                {{ t(`userData.stages.${stage}`) }}
              </option>
            </select>
          </td>

          <td class="user-data__cell user-data__cell--value">
            <UniformValueInput
              :kind="definition.kind"
              :value="definition.value"
              @change="onValueChange(definition.id, $event)"
            />
          </td>

          <td class="user-data__cell user-data__cell--actions">
            <button
              type="button"
              class="user-data__remove"
              :aria-label="`${t('userData.remove')} ${definition.name}`"
              @click="emit('remove', definition.id)"
            >
              {{ t('userData.remove') }}
            </button>
          </td>
        </tr>
      </tbody>
    </table>

    <section
      class="user-data__generated"
      :aria-label="t('userData.generated.title')"
    >
      <h3 class="user-data__generated-title">
        {{ t('userData.generated.title') }}
      </h3>
      <p class="user-data__generated-note">
        {{ t('userData.generated.note') }}
      </p>

      <p
        v-if="generatedBlocks.length === 0"
        class="user-data__generated-empty"
      >
        {{ t('userData.generated.empty') }}
      </p>

      <template v-else>
        <div
          v-for="block in generatedBlocks"
          :key="block.stage"
          class="user-data__generated-block"
        >
          <h4 class="user-data__generated-stage">
            {{ t(`userData.generated.${block.stage}`) }}
          </h4>
          <pre class="user-data__glsl"><code>{{ block.lines.join('\n') }}</code></pre>
        </div>
      </template>
    </section>
  </section>
</template>

<style scoped>
.user-data {
  display: flex;
  flex-direction: column;
  gap: 12px;
  height: 100%;
  min-height: 0;
  padding: 14px 16px 20px;
  overflow: auto;
  background: var(--bg);
}

.user-data__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.user-data__title {
  margin: 0;
  color: var(--fg-strong);
  font-family: var(--font-mono);
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.user-data__description {
  margin: 4px 0 0;
  max-width: 72ch;
  color: var(--fg-muted);
  font-size: 12px;
  line-height: 1.5;
}

.user-data__add {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  padding: 10px 12px;
  background: var(--bg-elevated);
  border: 1px solid var(--border-subtle);
  border-radius: 5px;
}

.user-data__add-title {
  margin: 0 4px 0 0;
  color: var(--fg-muted);
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.user-data__new-name,
.user-data__name {
  min-width: 0;
  padding: 4px 7px;
  background: var(--bg-input);
  color: var(--fg-strong);
  border: 1px solid var(--border);
  border-radius: 3px;
  font-family: var(--font-mono);
  font-size: 12px;
}

.user-data__new-name {
  width: 160px;
}

.user-data__new-kind,
.user-data__kind,
.user-data__stages {
  padding: 4px 6px;
  background: var(--bg-input);
  color: var(--fg);
  border: 1px solid var(--border);
  border-radius: 3px;
  font-family: var(--font-mono);
  font-size: 11px;
}

.user-data__add-button,
.user-data__remove {
  padding: 4px 10px;
  background: #404754;
  color: var(--fg-strong);
  border: 1px solid #4b5263;
  border-radius: 3px;
  font-family: var(--font-mono);
  font-size: 11px;
  cursor: pointer;
}

.user-data__add-button:hover,
.user-data__remove:hover {
  background: #4b5263;
  border-color: var(--accent-blue);
}

.user-data__add-error,
.user-data__row-error {
  color: var(--accent-red);
  font-family: var(--font-sans);
  font-size: 11px;
}

.user-data__row-error {
  display: block;
  margin-top: 3px;
  max-width: 220px;
  line-height: 1.4;
}

.user-data__empty {
  margin: 0;
  padding: 18px;
  color: var(--fg-subtle);
  border: 1px dashed var(--border);
  border-radius: 5px;
  font-size: 12px;
  text-align: center;
}

.user-data__table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}

.user-data__table th {
  padding: 6px 8px;
  color: var(--fg-subtle);
  border-bottom: 1px solid var(--border);
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-align: left;
  text-transform: uppercase;
}

.user-data__table td {
  padding: 6px 8px;
  border-bottom: 1px solid var(--border-subtle);
  vertical-align: middle;
}

.user-data__row:hover {
  background: var(--bg-elevated);
}

.user-data__row--highlighted {
  background: rgba(224, 108, 117, 0.14);
  box-shadow: inset 3px 0 0 var(--accent-red);
}

.user-data__cell--name {
  width: 26%;
}

.user-data__cell--name .user-data__name {
  width: 100%;
}

.user-data__cell--value {
  width: 36%;
}

.user-data__cell--actions {
  width: 1%;
  white-space: nowrap;
}

.user-data__actions-heading {
  text-align: right !important;
}

.user-data__generated {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 4px;
  padding: 12px;
  background: var(--bg-elevated);
  border: 1px solid var(--border-subtle);
  border-radius: 5px;
}

.user-data__generated-title {
  margin: 0;
  color: var(--fg-muted);
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.user-data__generated-note {
  margin: 0;
  color: var(--fg-subtle);
  font-size: 11px;
  line-height: 1.45;
}

.user-data__generated-empty {
  margin: 0;
  color: var(--fg-subtle);
  font-size: 11px;
  font-style: italic;
}

.user-data__generated-block {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.user-data__generated-stage {
  margin: 0;
  color: var(--fg-muted);
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 600;
}

.user-data__glsl {
  margin: 0;
  padding: 8px 10px;
  max-height: 180px;
  overflow: auto;
  background: var(--bg-input);
  border: 1px solid var(--border);
  border-radius: 4px;
  color: var(--fg-strong);
  font-family: var(--font-mono);
  font-size: 11px;
  line-height: 1.5;
  white-space: pre;
}
</style>
