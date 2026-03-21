<script setup lang="ts">
import { ref } from 'vue'
import { useAppStore } from '../stores/app'

const store = useAppStore()
const message = ref('')
const importMode = ref<'replace' | 'merge'>('merge')

function download(filename: string, content: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

function exportJson(): void {
  download('exam-review-backup.json', store.exportJson(), 'application/json')
  message.value = 'Respaldo JSON exportado.'
}

function exportCsv(): void {
  download('exam-review-grades.csv', store.exportGradesCsv(), 'text/csv;charset=utf-8;')
  message.value = 'Reporte CSV exportado.'
}

function onImportFile(event: Event): void {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]

  if (!file) {
    return
  }

  const reader = new FileReader()
  reader.onload = () => {
    const raw = String(reader.result ?? '')
    const result = store.importJson(raw, importMode.value)
    message.value = result.message
  }
  reader.readAsText(file)
}

function resetApp(): void {
  if (!window.confirm('¿Seguro que deseas borrar todos los datos locales?')) {
    return
  }

  store.resetAll()
  message.value = 'Datos locales eliminados.'
}
</script>

<template>
  <section class="panel">
    <h1>Respaldo e importación</h1>

    <article class="card stack">
      <h3>Exportar</h3>
      <div class="actions">
        <button type="button" @click="exportJson">Exportar JSON</button>
        <button type="button" @click="exportCsv">Exportar CSV</button>
      </div>
    </article>

    <article class="card stack">
      <h3>Importar JSON</h3>
      <label>
        Modo
        <select v-model="importMode">
          <option value="merge">Fusionar</option>
          <option value="replace">Reemplazar</option>
        </select>
      </label>
      <input type="file" accept="application/json" @change="onImportFile" />
    </article>

    <article class="card stack">
      <h3>Zona de riesgo</h3>
      <button type="button" class="danger" @click="resetApp">Borrar datos locales</button>
    </article>

    <p class="muted">{{ message }}</p>
  </section>
</template>
