<script setup lang="ts">
import { computed } from 'vue'
import { useAppStore } from '../stores/app'

const store = useAppStore()

const totalStudents = computed(() => store.students.length)
const totalClassrooms = computed(() => store.classrooms.length)
const totalExams = computed(() => store.exams.length)
const totalResults = computed(() => store.results.length)

const latestExams = computed(() =>
  [...store.exams]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5),
)
</script>

<template>
  <section class="panel">
    <h1>Panel general</h1>
    <p class="muted">Resumen rápido del avance de revisión de exámenes.</p>

    <div class="stats-grid">
      <article class="stat-card">
        <h2>{{ totalClassrooms }}</h2>
        <p>Aulas</p>
      </article>
      <article class="stat-card">
        <h2>{{ totalStudents }}</h2>
        <p>Alumnos registrados</p>
      </article>
      <article class="stat-card">
        <h2>{{ totalExams }}</h2>
        <p>Exámenes creados</p>
      </article>
      <article class="stat-card">
        <h2>{{ totalResults }}</h2>
        <p>Calificaciones guardadas</p>
      </article>
    </div>

    <article class="card">
      <h3>Exámenes recientes</h3>
      <ul v-if="latestExams.length" class="clean-list">
        <li v-for="exam in latestExams" :key="exam.id" class="list-row">
          <span>{{ exam.title }}</span>
          <small>{{ exam.year }}</small>
        </li>
      </ul>
      <p v-else class="muted">Aún no hay exámenes creados.</p>
    </article>
  </section>
</template>
