<script setup lang="ts">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  useId,
} from 'vue';

import type { ShaderExample } from '@/core/constants/shaderExamples';
import { Library } from 'lucide-vue-next';

const props = defineProps<{
  examples: readonly ShaderExample[];
}>();

const emit = defineEmits<{
  (e: 'load', id: string): void;
}>();

type MenuFocusTarget = 'first' | 'last';

const menuId = useId();

const rootRef = ref<HTMLElement | null>(null);
const triggerRef = ref<HTMLButtonElement | null>(null);
const menuRef = ref<HTMLUListElement | null>(null);

const menuOpen = ref(false);

/**
 * Consecutive examples sharing a group become one menu section. The registry
 * is authored in menu order, so grouping never has to sort or copy the list.
 */
const sections = computed(() => {
  const grouped: { label: string; items: ShaderExample[] }[] = [];

  for (const example of props.examples) {
    const current = grouped[grouped.length - 1];

    if (current?.label === example.group) {
      current.items.push(example);
    } else {
      grouped.push({ label: example.group, items: [example] });
    }
  }

  return grouped;
});

function getMenuItems(): HTMLButtonElement[] {
  if (!menuRef.value) return [];

  return Array.from(
    menuRef.value.querySelectorAll<HTMLButtonElement>('[role="menuitem"]'),
  );
}

function focusMenuItem(target: MenuFocusTarget): void {
  const items = getMenuItems();
  const item = target === 'last' ? items[items.length - 1] : items[0];

  item?.focus();
}

function openMenu(target: MenuFocusTarget = 'first'): void {
  if (props.examples.length === 0) return;

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

function loadExample(example: ShaderExample): void {
  closeMenu(true);
  emit('load', example.id);
}

function handleTriggerKeydown(event: KeyboardEvent): void {
  switch (event.key) {
    case 'ArrowDown':
      event.preventDefault();
      openMenu('first');
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
  <div ref="rootRef" class="examples-menu">
    <button
      ref="triggerRef"
      type="button"
      class="examples-menu__trigger"
      :class="{ 'examples-menu__trigger--open': menuOpen }"
      aria-label="Load a shader example"
      aria-haspopup="menu"
      :aria-expanded="menuOpen"
      :aria-controls="menuOpen ? menuId : undefined"
      @click="toggleMenu"
      @keydown="handleTriggerKeydown"
    >
      <Library :size="13" aria-hidden="true" />
      <span>Examples</span>
      <svg class="examples-menu__chevron" viewBox="0 0 10 6" aria-hidden="true">
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
      class="examples-menu__list"
      role="menu"
      aria-label="Shader examples"
      @keydown="handleMenuKeydown"
    >
      <template v-for="section in sections" :key="section.label">
        <li role="presentation" class="examples-menu__section">
          {{ section.label }}
        </li>

        <li v-for="example in section.items" :key="example.id" role="none">
          <button
            type="button"
            role="menuitem"
            class="examples-menu__item"
            :data-example-id="example.id"
            @click="loadExample(example)"
          >
            <span class="examples-menu__item-label">
              {{ example.label }}
            </span>
            <span class="examples-menu__item-hint">
              {{ example.description }}
            </span>
          </button>
        </li>
      </template>
    </ul>
  </div>
</template>

<style scoped>
.examples-menu {
  position: relative;
}

.examples-menu__trigger {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 10px;
  background: transparent;
  color: var(--fg-muted);
  border: 1px solid transparent;
  border-radius: 4px;
  font-family: var(--font-mono);
  font-size: 12px;
  cursor: pointer;
  transition:
    color 0.12s ease,
    background 0.12s ease,
    border-color 0.12s ease;
}

.examples-menu__trigger:hover,
.examples-menu__trigger--open {
  background: var(--bg-raised);
  border-color: var(--border);
  color: var(--fg-strong);
}

.examples-menu__chevron {
  width: 8px;
  height: 5px;
  flex: none;
  transition: transform 0.12s ease;
}

.examples-menu__trigger--open .examples-menu__chevron {
  transform: rotate(180deg);
}

/* Anchored to the trigger's right edge: the menu sits next to the Compile
   button, so it has to open towards the middle of the toolbar. */
.examples-menu__list {
  position: absolute;
  top: calc(100% + 7px);
  right: 0;
  z-index: 20;
  min-width: 248px;
  max-height: min(60vh, 420px);
  overflow: auto;
  margin: 0;
  padding: 3px;
  list-style: none;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: 5px;
  box-shadow: 0 8px 24px var(--shadow);
}

.examples-menu__section {
  padding: 8px 8px 4px;
  color: var(--fg-subtle);
  font-family: var(--font-mono);
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  user-select: none;
}

.examples-menu__item {
  display: flex;
  flex-direction: column;
  gap: 1px;
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

.examples-menu__item:hover,
.examples-menu__item:focus-visible {
  background: var(--bg-raised);
  color: var(--fg-strong);
  outline: none;
}

.examples-menu__item-hint {
  color: var(--fg-subtle);
  font-size: 10px;
}
</style>
