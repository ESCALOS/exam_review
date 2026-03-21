<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  Title,
  Tooltip,
} from 'chart.js'
import { Bar, Pie } from 'vue-chartjs'
import { useAppStore } from '../stores/app'
import { getExamMaxRawScore, getPassFail } from '../utils/grading'

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Title, Tooltip, Legend)

const store = useAppStore()
const selectedExamId = ref('')

const selectedExam = computed(() => store.getExamById(selectedExamId.value))
const examResults = computed(() => store.results.filter((result) => result.examId === selectedExamId.value))
const maxExamScore = computed(() => (selectedExam.value ? getExamMaxRawScore(selectedExam.value) : 0))
const averageScore = computed(() => {
  if (!examResults.value.length) {
    return 0
  }

  const total = examResults.value.reduce((sum, result) => sum + result.rawScore, 0)
  return Number((total / examResults.value.length).toFixed(2))
})

const distributionData = computed(() => {
  const max = maxExamScore.value
  const rangeSize = max > 0 ? max / 5 : 1
  const buckets = [0, 0, 0, 0, 0]

  for (const result of examResults.value) {
    const bucketIndex = Math.min(4, Math.floor(result.rawScore / rangeSize))
    buckets[bucketIndex] += 1
  }

  const labels = Array.from({ length: 5 }, (_, index) => {
    const start = Number((index * rangeSize).toFixed(2))
    const end = Number(((index + 1) * rangeSize).toFixed(2))
    return `${start}-${end}`
  })

  return {
    labels,
    datasets: [
      {
        label: 'Cantidad de alumnos',
        data: buckets,
        backgroundColor: ['#d73027', '#fc8d59', '#fee08b', '#91cf60', '#1a9850'],
      },
    ],
  }
})

const passFailData = computed(() => {
  const approved = examResults.value.filter((item) => getPassFail(item.rawScore, item.maxRawScore) === 'Aprobado').length
  const failed = examResults.value.length - approved

  return {
    labels: ['Aprobados', 'Desaprobados'],
    datasets: [
      {
        data: [approved, failed],
        backgroundColor: ['#1a9850', '#d73027'],
      },
    ],
  }
})

const questionPerformanceData = computed(() => {
  const exam = selectedExam.value

  if (!exam) {
    return {
      labels: [],
      datasets: [{ label: 'Rendimiento (%)', data: [] as number[], backgroundColor: '#2563eb' }],
    }
  }

  const totals = exam.questions.map((question) => ({
    question,
    obtained: 0,
    maximum: 0,
  }))

  for (const result of examResults.value) {
    for (const bucket of totals) {
      const answer = result.answers.find((item) => item.questionId === bucket.question.id)
      bucket.maximum += bucket.question.points

      if (!answer) {
        continue
      }

      if (bucket.question.type === 'mcq') {
        const typedMatch =
          (answer.selectedText ?? '').trim().toLowerCase() ===
          (bucket.question.correctAnswer ?? '').trim().toLowerCase()
        const legacyMatch =
          answer.selectedOptionIndex !== undefined &&
          bucket.question.correctOptionIndex !== undefined &&
          answer.selectedOptionIndex === bucket.question.correctOptionIndex
        const isCorrect = typedMatch || legacyMatch
        bucket.obtained += isCorrect ? bucket.question.points : 0
      } else {
        bucket.obtained += Number(answer.freeScore ?? 0)
      }
    }
  }

  return {
    labels: totals.map((_, index) => `P${index + 1}`),
    datasets: [
      {
        label: 'Rendimiento (%)',
        backgroundColor: '#2563eb',
        data: totals.map((bucket) => {
          if (bucket.maximum === 0) {
            return 0
          }

          return Number(((bucket.obtained / bucket.maximum) * 100).toFixed(2))
        }),
      },
    ],
  }
})
</script>

<template>
  <section class="panel">
    <h1>Reportes</h1>

    <article class="card">
      <div class="toolbar-flex">
        <label>
          Examen
          <select v-model="selectedExamId">
            <option value="">Seleccionar</option>
            <option v-for="exam in store.exams" :key="exam.id" :value="exam.id">
              {{ exam.title }} - {{ exam.year }}
            </option>
          </select>
        </label>
      </div>
    </article>

    <div v-if="selectedExam && examResults.length" class="charts-grid">
      <article class="card report-summary">
        <p><strong>Puntaje máximo:</strong> {{ maxExamScore }}</p>
        <p><strong>Promedio:</strong> {{ averageScore }}</p>
        <p><strong>Regla de aprobación:</strong> 55% del puntaje total</p>
      </article>

      <article class="card">
        <h3>Distribución de notas</h3>
        <div class="chart-box">
          <Bar :data="distributionData" :options="{ responsive: true, maintainAspectRatio: false }" />
        </div>
      </article>

      <article class="card">
        <h3>Aprobados vs desaprobados</h3>
        <div class="chart-box">
          <Pie :data="passFailData" :options="{ responsive: true, maintainAspectRatio: false }" />
        </div>
      </article>

      <article class="card wide">
        <h3>Rendimiento por pregunta</h3>
        <div class="chart-box chart-box-wide">
          <Bar :data="questionPerformanceData" :options="{ responsive: true, maintainAspectRatio: false }" />
        </div>
      </article>
    </div>

    <article v-else-if="selectedExam" class="card">
      <p class="muted">Este examen aún no tiene calificaciones.</p>
    </article>

    <article v-else class="card">
      <p class="muted">Selecciona un examen para visualizar reportes.</p>
    </article>
  </section>
</template>
