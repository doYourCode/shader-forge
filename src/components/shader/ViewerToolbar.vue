<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, useId } from 'vue';
import { ChevronDown, Pause, Play, Settings } from 'lucide-vue-next';

const props = defineProps<{
  wireframe: boolean;
  paused: boolean;
}>();

const emit = defineEmits<{
  (e: 'toggle-wireframe'): void;
  (e: 'toggle-pause'): void;
}>();

const menuId = useId();

const rootRef = ref<HTMLElement | null>(null);
const triggerRef = ref<HTMLButtonElement | null>(null);
const menuRef = ref<HTMLUListElement | null>(null);

const menuOpen = ref(false);

function focusMenuItem(): void {
  menuRef.value
    ?.querySelector<HTMLButtonElement>('[role="menuitemcheckbox"]')
    ?.focus();
}

function openMenu(): void {
  if (!menuOpen.value) {
    menuOpen.value = true;
  }

  void nextTick(focusMenuItem);
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

function toggleWireframe(): void {
  emit('toggle-wireframe');
  closeMenu(true);
}

function handleTriggerKeydown(event: KeyboardEvent): void {
  switch (event.key) {
    case 'ArrowDown':
      event.preventDefault();
      openMenu();
      break;
    case 'Escape':
      closeMenu();
      break;
  }
}

function handleMenuKeydown(event: KeyboardEvent): void {
  switch (event.key) {
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
  <div class="viewer-toolbar">
    <div class="viewer-toolbar__group">
      <div ref="rootRef" class="viewer-toolbar__cfg">
        <button
          ref="triggerRef"
          type="button"
          class="viewer-toolbar__btn"
          :class="{ 'viewer-toolbar__btn--active': props.wireframe }"
          aria-haspopup="menu"
          :aria-expanded="menuOpen"
          :aria-controls="menuOpen ? menuId : undefined"
          @click="toggleMenu"
          @keydown="handleTriggerKeydown"
        >
          <Settings :size="13" aria-hidden="true" />
          <span>Cfg</span>
          <ChevronDown
            class="viewer-toolbar__chevron"
            :size="11"
            aria-hidden="true"
          />
        </button>

        <ul
          v-if="menuOpen"
          :id="menuId"
          ref="menuRef"
          class="viewer-toolbar__menu"
          role="menu"
          aria-label="Viewer settings"
          @keydown="handleMenuKeydown"
        >
          <li role="none">
            <button
              type="button"
              role="menuitemcheckbox"
              class="viewer-toolbar__menu-item"
              :aria-checked="props.wireframe"
              @click="toggleWireframe"
            >
              <span class="viewer-toolbar__menu-check" aria-hidden="true">
                {{ props.wireframe ? '✓' : '' }}
              </span>
              <span>Toggle Wireframe</span>
            </button>
          </li>
        </ul>
      </div>

      <button
        class="viewer-toolbar__btn"
        :class="{ 'viewer-toolbar__btn--active': props.paused }"
        @click="emit('toggle-pause')"
      >
        <Pause v-if="!props.paused" :size="13" aria-hidden="true" />
        <Play v-else :size="13" aria-hidden="true" />
        <span>{{ props.paused ? 'Resume' : 'Pause' }}</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.viewer-toolbar {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex-wrap: wrap;
  row-gap: 4px;
  padding: 6px 10px;
  border-bottom: 1px solid var(--border-subtle);
  background: var(--bg-elevated);
}

.viewer-toolbar__group {
  display: flex;
  align-items: center;
  gap: 4px;
}

.viewer-toolbar__cfg {
  position: relative;
}

.viewer-toolbar__btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 10px;
  background: var(--bg-raised);
  color: var(--fg);
  border: 1px solid var(--border);
  border-radius: 4px;
  font-family: var(--font-ui);
  font-size: var(--font-size-ui);
  cursor: pointer;
  transition:
    color 0.12s ease,
    background 0.12s ease,
    border-color 0.12s ease;
}

.viewer-toolbar__btn:hover {
  background: #3a404d;
  border-color: #4b5263;
  color: var(--fg-strong);
}

.viewer-toolbar__btn--active {
  background: #404754;
  border-color: var(--accent-ui);
  color: var(--fg-strong);
}

.viewer-toolbar__chevron {
  flex: none;
}

.viewer-toolbar__menu {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  z-index: 20;
  min-width: 184px;
  margin: 0;
  padding: 3px;
  list-style: none;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: 5px;
  box-shadow: 0 8px 24px var(--shadow);
}

.viewer-toolbar__menu-item {
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

.viewer-toolbar__menu-item:hover,
.viewer-toolbar__menu-item:focus-visible {
  background: var(--bg-raised);
  color: var(--fg-strong);
  outline: none;
}

.viewer-toolbar__menu-check {
  width: 10px;
  flex: none;
  color: var(--accent-ui);
  font-size: 11px;
  line-height: 1;
}
</style>
