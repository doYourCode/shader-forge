<script setup lang="ts">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  useId,
} from 'vue';
import { ChevronDown } from 'lucide-vue-next';

import type {
  EditorTab,
  EditorTabGroup,
  EditorTabId,
} from '@/core/models/editorTab';

type MenuFocusTarget = 'selected' | 'last';

const props = defineProps<{
  group: EditorTabGroup;
  active: EditorTabId;
}>();

const emit = defineEmits<{
  (e: 'switch', id: EditorTabId): void;
}>();

const labelId = useId();
const menuId = useId();

const rootRef = ref<HTMLElement | null>(null);
const triggerRef = ref<HTMLButtonElement | null>(null);
const menuRef = ref<HTMLUListElement | null>(null);

const menuOpen = ref(false);

/** The document of this group that is currently open, if any. */
const activeTab = computed<EditorTab | null>(
  () => props.group.tabs.find((tab) => tab.id === props.active) ?? null,
);

function getMenuItems(): HTMLButtonElement[] {
  if (!menuRef.value) return [];

  return Array.from(
    menuRef.value.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]'),
  );
}

function focusMenuItem(target: MenuFocusTarget): void {
  const items = getMenuItems();
  if (items.length === 0) return;

  const selected = items.find((item) => item.dataset.tabId === props.active);

  const item =
    target === 'last' ? items[items.length - 1] : (selected ?? items[0]);

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

function selectTab(tab: EditorTab): void {
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
  <div ref="rootRef" class="tab-group">
    <button
      ref="triggerRef"
      type="button"
      class="tab-group__trigger"
      :class="{
        'tab-group__trigger--active': activeTab !== null,
        'tab-group__trigger--open': menuOpen,
      }"
      :aria-label="`${props.group.label}: ${activeTab?.label ?? 'no document'}`"
      aria-haspopup="menu"
      :aria-expanded="menuOpen"
      :aria-controls="menuOpen ? menuId : undefined"
      @click="toggleMenu"
      @keydown="handleTriggerKeydown"
    >
      <span :id="labelId" class="tab-group__label">{{
        props.group.label
      }}</span>
      <span v-if="activeTab" class="tab-group__current">
        {{ activeTab.label }}
      </span>
      <ChevronDown class="tab-group__chevron" :size="11" aria-hidden="true" />
    </button>

    <ul
      v-if="menuOpen"
      :id="menuId"
      ref="menuRef"
      class="tab-group__menu"
      role="menu"
      :aria-labelledby="labelId"
      @keydown="handleMenuKeydown"
    >
      <li v-for="tab in props.group.tabs" :key="tab.id" role="none">
        <button
          type="button"
          role="menuitemradio"
          class="tab-group__item"
          :class="{ 'tab-group__item--selected': tab.id === props.active }"
          :aria-checked="tab.id === props.active"
          :data-tab-id="tab.id"
          @click="selectTab(tab)"
        >
          <span class="tab-group__check" aria-hidden="true">
            {{ tab.id === props.active ? '✓' : '' }}
          </span>
          <span>{{ tab.label }}</span>
        </button>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.tab-group {
  position: relative;
}

.tab-group__trigger {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 12px;
  background: transparent;
  color: var(--fg-muted);
  border: 1px solid transparent;
  border-radius: 4px;
  font-family: var(--font-ui);
  font-size: var(--font-size-ui);
  white-space: nowrap;
  cursor: pointer;
  transition:
    color 0.12s ease,
    background 0.12s ease,
    border-color 0.12s ease;
}

.tab-group__trigger:hover,
.tab-group__trigger--open {
  background: var(--bg-raised);
  color: var(--fg-strong);
}

.tab-group__trigger--active {
  background: var(--bg);
  border-color: var(--border);
  color: var(--fg-strong);
  box-shadow: inset 0 -2px 0 var(--accent-ui);
}

.tab-group__current {
  color: var(--fg-subtle);
  font-size: var(--font-size-label);
}

.tab-group__trigger--active .tab-group__current {
  color: var(--accent-ui);
}

.tab-group__chevron {
  flex: none;
  transition: transform 0.12s ease;
}

.tab-group__trigger--open .tab-group__chevron {
  transform: rotate(180deg);
}

.tab-group__menu {
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

.tab-group__item {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  padding: 6px 8px;
  background: transparent;
  color: var(--fg);
  border: 1px solid transparent;
  border-radius: 3px;
  font-family: var(--font-ui);
  font-size: var(--font-size-ui);
  text-align: left;
  cursor: pointer;
}

.tab-group__item:hover,
.tab-group__item:focus-visible {
  background: var(--bg-raised);
  color: var(--fg-strong);
  outline: none;
}

.tab-group__item--selected {
  color: var(--fg-strong);
}

.tab-group__check {
  width: 10px;
  flex: none;
  color: var(--accent-ui);
  font-size: 11px;
  line-height: 1;
}
</style>
