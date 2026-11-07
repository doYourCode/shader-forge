<script setup lang="ts">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  useId,
  watch,
} from 'vue';
import type {
  EditorTab,
  EditorTabGroup,
  EditorTabId,
} from '@/core/models/editorTab';

type MenuFocusTarget = 'selected' | 'last';

const props = defineProps<{
  tabs: readonly EditorTab[];
  builtIn: EditorTabGroup;
  active: EditorTabId;
}>();

const emit = defineEmits<{
  (e: 'switch', id: EditorTabId): void;
  (e: 'compile'): void;
}>();

const labelId = useId();
const menuId = useId();

const rootRef = ref<HTMLElement | null>(null);
const triggerRef = ref<HTMLButtonElement | null>(null);
const menuRef = ref<HTMLUListElement | null>(null);

const menuOpen = ref(false);
const selectedBuiltInId = ref<EditorTabId | null>(
  props.builtIn.tabs[0]?.id ?? null,
);

const isBuiltInActive = computed(() =>
  props.builtIn.tabs.some((tab) => tab.id === props.active),
);

const selectedBuiltInTab = computed<EditorTab | null>(
  () =>
    props.builtIn.tabs.find((tab) => tab.id === selectedBuiltInId.value) ??
    props.builtIn.tabs[0] ??
    null,
);

// Switching to a built-in document by any route (dropdown or otherwise) keeps
// the collapsed trigger showing the document that is actually open.
watch(
  () => props.active,
  (active) => {
    if (props.builtIn.tabs.some((tab) => tab.id === active)) {
      selectedBuiltInId.value = active;
    }
  },
  { immediate: true },
);

function getMenuItems(): HTMLButtonElement[] {
  if (!menuRef.value) return [];

  return Array.from(
    menuRef.value.querySelectorAll<HTMLButtonElement>(
      '[role="menuitemradio"]',
    ),
  );
}

function focusMenuItem(target: MenuFocusTarget): void {
  const items = getMenuItems();
  if (items.length === 0) return;

  const selected = items.find(
    (item) => item.dataset.tabId === selectedBuiltInId.value,
  );

  const item =
    target === 'last'
      ? items[items.length - 1]
      : (selected ?? items[0]);

  item?.focus();
}

function openMenu(target: MenuFocusTarget = 'selected'): void {
  if (!menuOpen.value) {
    menuOpen.value = true;
  }

  void nextTick(() => focusMenuItem(target));
}

function closeMenu(restoreFocus = false): void {
  if (!menuOpen.value) return;

  menuOpen.value = false;

  if (restoreFocus) {
    triggerRef.value?.focus();
  }
}

function toggleMenu(): void {
  if (menuOpen.value) {
    closeMenu();
    return;
  }

  openMenu();
}

function handleTriggerClick(): void {
  if (!isBuiltInActive.value) {
    const selected = selectedBuiltInTab.value;
    if (!selected) return;

    emit('switch', selected.id);
    openMenu();
    return;
  }

  toggleMenu();
}

function selectBuiltIn(tab: EditorTab): void {
  selectedBuiltInId.value = tab.id;
  emit('switch', tab.id);
  closeMenu(true);
}

function handleTriggerKeydown(event: KeyboardEvent): void {
  switch (event.key) {
    case 'ArrowDown':
      event.preventDefault();
      openMenu('selected');
      break;
    case 'ArrowUp':
      event.preventDefault();
      openMenu('last');
      break;
    case 'Escape':
      closeMenu();
      break;
  }
}

function handleMenuKeydown(event: KeyboardEvent): void {
  const items = getMenuItems();
  if (items.length === 0) return;

  const activeIndex = items.findIndex(
    (item) => item === document.activeElement,
  );

  switch (event.key) {
    case 'ArrowDown': {
      event.preventDefault();
      const next = activeIndex < 0 ? 0 : (activeIndex + 1) % items.length;
      items[next]?.focus();
      break;
    }
    case 'ArrowUp': {
      event.preventDefault();
      const previous =
        activeIndex < 0
          ? items.length - 1
          : (activeIndex - 1 + items.length) % items.length;
      items[previous]?.focus();
      break;
    }
    case 'Home':
      event.preventDefault();
      items[0]?.focus();
      break;
    case 'End':
      event.preventDefault();
      items[items.length - 1]?.focus();
      break;
    case 'Escape':
      event.preventDefault();
      closeMenu(true);
      break;
    case 'Tab':
      closeMenu(true);
      break;
  }
}

function handleDocumentPointerDown(event: PointerEvent): void {
  if (!menuOpen.value) return;

  const root = rootRef.value;
  if (root && event.target instanceof Node && root.contains(event.target)) {
    return;
  }

  closeMenu();
}

onMounted(() => {
  document.addEventListener('pointerdown', handleDocumentPointerDown);
});

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', handleDocumentPointerDown);
});
</script>

<template>
  <div class="editor-toolbar">
    <div class="editor-toolbar__tabs">
      <button
        v-for="tab in props.tabs"
        :key="tab.id"
        type="button"
        class="editor-toolbar__tab"
        :class="{ 'editor-toolbar__tab--active': tab.id === props.active }"
        @click="emit('switch', tab.id)"
      >
        {{ tab.label }}
      </button>

      <fieldset
        class="editor-toolbar__builtin"
        :class="{
          'editor-toolbar__builtin--active': isBuiltInActive,
        }"
      >
        <legend :id="labelId" class="editor-toolbar__builtin-label">
          {{ props.builtIn.label }}
        </legend>

        <div ref="rootRef" class="editor-toolbar__dropdown">
          <button
            ref="triggerRef"
            type="button"
            class="editor-toolbar__tab editor-toolbar__tab--builtin"
            :class="{
              'editor-toolbar__tab--active': isBuiltInActive,
              'editor-toolbar__tab--open': menuOpen,
            }"
            :aria-label="`${props.builtIn.label} documents: ${
              selectedBuiltInTab?.label ?? ''
            }`"
            aria-haspopup="menu"
            :aria-expanded="menuOpen"
            :aria-controls="menuOpen ? menuId : undefined"
            @click="handleTriggerClick"
            @keydown="handleTriggerKeydown"
          >
            <span>{{ selectedBuiltInTab?.label }}</span>
            <svg
              class="editor-toolbar__chevron"
              viewBox="0 0 10 6"
              aria-hidden="true"
            >
              <path
                d="M1 1l4 4 4-4"
                fill="none"
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          </button>

          <ul
            v-if="menuOpen"
            :id="menuId"
            ref="menuRef"
            class="editor-toolbar__menu"
            role="menu"
            :aria-labelledby="labelId"
            @keydown="handleMenuKeydown"
          >
            <li
              v-for="tab in props.builtIn.tabs"
              :key="tab.id"
              role="none"
            >
              <button
                type="button"
                role="menuitemradio"
                class="editor-toolbar__menu-item"
                :class="{
                  'editor-toolbar__menu-item--selected':
                    tab.id === selectedBuiltInId,
                }"
                :aria-checked="tab.id === selectedBuiltInId"
                :data-tab-id="tab.id"
                @click="selectBuiltIn(tab)"
              >
                <span class="editor-toolbar__menu-check" aria-hidden="true">
                  {{ tab.id === selectedBuiltInId ? '✓' : '' }}
                </span>
                <span>{{ tab.label }}</span>
              </button>
            </li>
          </ul>
        </div>
      </fieldset>
    </div>

    <button
      type="button"
      class="editor-toolbar__compile"
      @click="emit('compile')"
    >
      Compile
    </button>
  </div>
</template>

<style scoped>
.editor-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 10px;
  border-bottom: 1px solid var(--border-subtle);
  background: var(--bg-elevated);
}

.editor-toolbar__tabs {
  display: flex;
  align-items: center;
  gap: 2px;
}

.editor-toolbar__tab {
  padding: 5px 12px;
  background: transparent;
  color: var(--fg-muted);
  border: 1px solid transparent;
  border-radius: 4px;
  font-family: var(--font-mono);
  font-size: 12px;
  cursor: pointer;
  transition: color 0.12s ease, background 0.12s ease,
    border-color 0.12s ease;
}

.editor-toolbar__tab:hover {
  background: var(--bg-raised);
  color: var(--fg-strong);
}

.editor-toolbar__tab--active {
  background: var(--bg);
  border-color: var(--border);
  color: var(--fg-strong);
  box-shadow: inset 0 -2px 0 var(--accent-blue);
}

/* The bordered, labelled area marks the collapsed tab as a built-in
   reference rather than an editable document. */
.editor-toolbar__builtin {
  margin: 0 0 0 6px;
  padding: 0 4px 2px;
  min-inline-size: 0;
  border: 1px solid var(--border);
  border-radius: 5px;
  transition: border-color 0.12s ease;
}

.editor-toolbar__builtin--active {
  border-color: rgba(97, 175, 239, 0.5);
}

.editor-toolbar__builtin-label {
  padding: 0 4px;
  margin-left: 3px;
  color: var(--fg-subtle);
  font-family: var(--font-mono);
  font-size: 7px;
  font-weight: 700;
  letter-spacing: 0.08em;
  line-height: 1;
  text-transform: uppercase;
  white-space: nowrap;
  user-select: none;
  transition: color 0.12s ease;
}

.editor-toolbar__builtin--active .editor-toolbar__builtin-label {
  color: var(--accent-blue);
}

.editor-toolbar__dropdown {
  position: relative;
}

.editor-toolbar__tab--builtin {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
}

.editor-toolbar__tab--open {
  background: var(--bg-raised);
  color: var(--fg-strong);
}

.editor-toolbar__chevron {
  width: 8px;
  height: 5px;
  flex: none;
  transition: transform 0.12s ease;
}

.editor-toolbar__tab--open .editor-toolbar__chevron {
  transform: rotate(180deg);
}

.editor-toolbar__menu {
  position: absolute;
  top: calc(100% + 7px);
  left: 0;
  z-index: 20;
  min-width: 168px;
  margin: 0;
  padding: 3px;
  list-style: none;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: 5px;
  box-shadow: 0 8px 24px var(--shadow);
}

.editor-toolbar__menu-item {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  padding: 6px 8px;
  background: transparent;
  color: var(--fg);
  border: 1px solid transparent;
  border-radius: 3px;
  font-family: var(--font-mono);
  font-size: 12px;
  text-align: left;
  cursor: pointer;
}

.editor-toolbar__menu-item:hover,
.editor-toolbar__menu-item:focus-visible {
  background: var(--bg-raised);
  color: var(--fg-strong);
  outline: none;
}

.editor-toolbar__menu-item--selected {
  color: var(--fg-strong);
}

.editor-toolbar__menu-check {
  width: 10px;
  flex: none;
  color: var(--accent-blue);
  font-size: 11px;
  line-height: 1;
}

.editor-toolbar__compile {
  padding: 5px 14px;
  background: #404754;
  color: var(--fg-strong);
  border: 1px solid #4b5263;
  border-radius: 4px;
  font-family: var(--font-mono);
  font-size: 12px;
  cursor: pointer;
  transition: background 0.12s ease, border-color 0.12s ease;
}

.editor-toolbar__compile:hover {
  background: #4b5263;
  border-color: var(--accent-blue);
}

.editor-toolbar__compile:active {
  background: #3a404d;
}
</style>
