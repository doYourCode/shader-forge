<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, useId } from 'vue';
import { ChevronDown } from 'lucide-vue-next';

type MenuFocusTarget = 'selected' | 'last';

const props = defineProps<{
  /** Category shown on the trigger, e.g. `Model` or `Environment`. */
  label: string;
  items: readonly {
    readonly id: string;
    readonly label: string;
    readonly thumbnailUrl?: string;
  }[];
  activeId: string;
}>();

const emit = defineEmits<{
  (e: 'select', id: string): void;
}>();

const menuId = useId();

const rootRef = ref<HTMLElement | null>(null);
const triggerRef = ref<HTMLButtonElement | null>(null);
const menuRef = ref<HTMLUListElement | null>(null);

const menuOpen = ref(false);

function getMenuItems(): HTMLButtonElement[] {
  if (!menuRef.value) return [];

  return Array.from(
    menuRef.value.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]'),
  );
}

function focusMenuItem(target: MenuFocusTarget): void {
  const items = getMenuItems();
  if (items.length === 0) return;

  const selected = items.find(
    (item) => item.dataset.assetId === props.activeId,
  );

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

function selectAsset(id: string): void {
  emit('select', id);
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
  <div ref="rootRef" class="scene-asset-menu">
    <button
      ref="triggerRef"
      type="button"
      class="scene-asset-menu__trigger"
      :class="{ 'scene-asset-menu__trigger--open': menuOpen }"
      :aria-label="props.label"
      aria-haspopup="menu"
      :aria-expanded="menuOpen"
      :aria-controls="menuOpen ? menuId : undefined"
      @click="toggleMenu"
      @keydown="handleTriggerKeydown"
    >
      <span class="scene-asset-menu__trigger-label">{{ props.label }}</span>
      <ChevronDown
        class="scene-asset-menu__chevron"
        :size="12"
        aria-hidden="true"
      />
    </button>

    <ul
      v-if="menuOpen"
      :id="menuId"
      ref="menuRef"
      class="scene-asset-menu__menu"
      role="menu"
      :aria-label="props.label"
      @keydown="handleMenuKeydown"
    >
      <li v-for="item in props.items" :key="item.id" role="none">
        <button
          type="button"
          role="menuitemradio"
          class="scene-asset-menu__item"
          :class="{
            'scene-asset-menu__item--selected': item.id === props.activeId,
          }"
          :aria-checked="item.id === props.activeId"
          :data-asset-id="item.id"
          @click="selectAsset(item.id)"
        >
          <img
            v-if="item.thumbnailUrl"
            class="scene-asset-menu__thumb"
            :src="item.thumbnailUrl"
            alt=""
            width="32"
            height="32"
            loading="lazy"
            decoding="async"
          />
          <span class="scene-asset-menu__name">{{ item.label }}</span>
          <span class="scene-asset-menu__check" aria-hidden="true">
            {{ item.id === props.activeId ? '✓' : '' }}
          </span>
        </button>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.scene-asset-menu {
  position: relative;
}

.scene-asset-menu__trigger {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  background: transparent;
  color: var(--fg-muted);
  border: 1px solid transparent;
  border-radius: 4px;
  font-family: var(--font-ui);
  font-size: 12px;
  cursor: pointer;
  transition:
    color 0.12s ease,
    background 0.12s ease,
    border-color 0.12s ease;
}

.scene-asset-menu__trigger:hover,
.scene-asset-menu__trigger--open {
  background: var(--bg-raised);
  border-color: var(--border);
  color: var(--fg-strong);
}

.scene-asset-menu__trigger-label {
  white-space: nowrap;
}

.scene-asset-menu__chevron {
  flex: none;
  /* The menu opens upwards, so the caret points that way. */
  transform: rotate(180deg);
}

.scene-asset-menu__menu {
  position: absolute;
  bottom: calc(100% + 6px);
  left: 0;
  z-index: 20;
  min-width: 200px;
  max-width: 280px;
  max-height: 50vh;
  margin: 0;
  padding: 3px;
  overflow: auto;
  list-style: none;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: 5px;
  box-shadow: 0 8px 24px var(--shadow);
}

.scene-asset-menu__item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 5px 6px;
  background: transparent;
  color: var(--fg);
  border: 1px solid transparent;
  border-radius: 3px;
  font-family: var(--font-ui);
  font-size: 12px;
  text-align: left;
  cursor: pointer;
}

.scene-asset-menu__item:hover,
.scene-asset-menu__item:focus-visible {
  background: var(--bg-raised);
  color: var(--fg-strong);
  outline: none;
}

.scene-asset-menu__item--selected {
  color: var(--fg-strong);
}

.scene-asset-menu__thumb {
  flex: none;
  width: 32px;
  height: 32px;
  object-fit: cover;
  border-radius: 3px;
}

.scene-asset-menu__name {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.scene-asset-menu__check {
  flex: none;
  width: 10px;
  color: var(--accent-ui);
  font-size: 11px;
  line-height: 1;
}
</style>
