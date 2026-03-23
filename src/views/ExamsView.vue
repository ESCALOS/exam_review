<script setup lang="ts">
import { computed, ref } from 'vue'
import type { ExamQuestion, QuestionType } from '../types/models'
import { createId } from '../utils/ids'
import { useAppStore } from '../stores/app'

const store = useAppStore()

const DEFAULT_QUESTION_COUNT = 20

const examForm = ref({
  title: '',
  classroomId: '',
  inicioMax: 12,
  procesoMax: 16,
})
const editingExamId = ref('')
const currentQuestionIndex = ref(0)
const multipleChoiceOptions = ['A', 'B', 'C', 'D', 'E'] as const

function normalizeChoice(value: string | undefined): string {
  const normalized = (value ?? '').trim().toUpperCase()
  return multipleChoiceOptions.includes(normalized as (typeof multipleChoiceOptions)[number]) ? normalized : ''
}

function createDefaultQuestions(count = DEFAULT_QUESTION_COUNT): ExamQuestion[] {
  return Array.from({ length: count }, () => ({
    id: createId('q'),
    prompt: '',
    type: 'mcq',
    points: 1,
    correctAnswer: '',
  }))
}

const questions = ref<ExamQuestion[]>(createDefaultQuestions())

const totalPoints = computed(() => questions.value.reduce((sum, q) => sum + Number(q.points || 0), 0))
const currentQuestion = computed(() => questions.value[currentQuestionIndex.value])
const questionCount = computed(() => questions.value.length)
const hasPreviousQuestion = computed(() => currentQuestionIndex.value > 0)
const hasNextQuestion = computed(() => currentQuestionIndex.value < questions.value.length - 1)
const questionOverview = computed(() => {
  return questions.value.map((question, index) => {
    const hasValue = question.type === 'mcq'
      ? normalizeChoice(question.correctAnswer).length > 0
      : Number(question.points) > 0

    return {
      id: question.id,
      index,
      isMarked: hasValue,
      value: question.type === 'mcq' ? (normalizeChoice(question.correctAnswer) || '-') : Number(question.points).toFixed(2),
    }
  })
})

function goToQuestion(index: number): void {
  if (!questions.value.length) {
    currentQuestionIndex.value = 0
    return
  }

  currentQuestionIndex.value = Math.min(Math.max(index, 0), questions.value.length - 1)
}

function previousQuestion(): void {
  if (hasPreviousQuestion.value) {
    currentQuestionIndex.value -= 1
  }
}

function nextQuestion(): void {
  if (hasNextQuestion.value) {
    currentQuestionIndex.value += 1
  }
}

function addQuestion(): void {
  questions.value.push({
    id: createId('q'),
    prompt: '',
    type: 'mcq',
    points: 1,
    correctAnswer: '',
  })

  currentQuestionIndex.value = questions.value.length - 1
}

function removeQuestion(questionId: string): void {
  questions.value = questions.value.filter((item) => item.id !== questionId)

  if (!questions.value.length) {
    questions.value = createDefaultQuestions(1)
    currentQuestionIndex.value = 0
    return
  }

  if (currentQuestionIndex.value >= questions.value.length) {
    currentQuestionIndex.value = questions.value.length - 1
  }
}

function updateType(question: ExamQuestion, type: QuestionType): void {
  question.type = type

  if (type === 'mcq') {
    question.correctAnswer = question.correctAnswer ?? ''
    return
  }

  delete question.correctAnswer
}

function submitExam(): void {
  const cleanedQuestions = questions.value
    .map((question, index) => ({
      ...question,
      prompt: `Pregunta ${index + 1}`,
      points: Number(question.points),
      correctAnswer: question.type === 'mcq' ? normalizeChoice(question.correctAnswer) : undefined,
      options: undefined,
      correctOptionIndex: undefined,
    }))
    .filter((question) => {
      if (question.points <= 0) {
        return false
      }

      if (question.type === 'mcq' && !question.correctAnswer) {
        return false
      }

      return true
    })

  if (!examForm.value.classroomId || !examForm.value.title.trim() || cleanedQuestions.length === 0) {
    return
  }

  const scaleConfig = {
    inicioMax: Math.round(Number(examForm.value.inicioMax)),
    procesoMax: Math.round(Number(examForm.value.procesoMax)),
  }

  examForm.value.inicioMax = scaleConfig.inicioMax
  examForm.value.procesoMax = scaleConfig.procesoMax

  if (!(scaleConfig.inicioMax < scaleConfig.procesoMax)) {
    return
  }

  if (editingExamId.value) {
    store.updateExam(editingExamId.value, {
      title: examForm.value.title,
      classroomId: examForm.value.classroomId,
      questions: cleanedQuestions,
      scaleConfig,
    })
  } else {
    const exam = store.createExam({
      title: examForm.value.title,
      classroomId: examForm.value.classroomId,
      questions: cleanedQuestions,
      scaleConfig,
    })

    if (!exam) {
      return
    }
  }

  resetForm()
}

function startEditExam(examId: string): void {
  const exam = store.getExamById(examId)

  if (!exam) {
    return
  }

  editingExamId.value = exam.id
  examForm.value.title = exam.title
  examForm.value.classroomId = exam.classroomId
  const scaleConfig = store.getExamScaleConfig(exam)
  examForm.value.inicioMax = scaleConfig.inicioMax
  examForm.value.procesoMax = scaleConfig.procesoMax
  questions.value = exam.questions.map((question) => ({
    id: question.id,
    prompt: question.prompt,
    type: question.type,
    points: question.points,
    correctAnswer: normalizeChoice(question.correctAnswer),
  }))
  currentQuestionIndex.value = 0
}

function deleteExam(examId: string): void {
  if (!window.confirm('Se eliminará el examen y sus resultados. ¿Deseas continuar?')) {
    return
  }

  store.deleteExam(examId)

  if (editingExamId.value === examId) {
    resetForm()
  }
}

function exportExamExcel(examId: string): void {
  const result = store.exportExamExcel(examId)

  if (!result.ok || !result.content || !result.filename) {
    window.alert(result.message)
    return
  }

  const blob = new Blob([result.content], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = result.filename
  anchor.click()
  URL.revokeObjectURL(url)
}

function resetForm(): void {
  editingExamId.value = ''
  currentQuestionIndex.value = 0
  examForm.value.title = ''
  examForm.value.classroomId = ''
  examForm.value.inicioMax = 12
  examForm.value.procesoMax = 16

  questions.value = createDefaultQuestions()
}
</script>

<template>
  <section class="panel">
    <h1>Crear examen</h1>

    <article class="card">
      <h3>{{ editingExamId ? 'Editar examen' : 'Nuevo examen' }}</h3>
      <form class="grid-form" @submit.prevent="submitExam">
        <label>
          Título del examen
          <input v-model="examForm.title" type="text" required />
        </label>

        <label>
          Aula
          <select v-model="examForm.classroomId" required>
            <option value="">Seleccionar</option>
            <option v-for="classroom in store.classrooms" :key="classroom.id" :value="classroom.id">
              {{ classroom.name }}
            </option>
          </select>
        </label>

        <p class="muted">Puntaje total del examen: {{ totalPoints }}</p>

        <div class="grid-form full-width">
          <label>
            Inicio (menor que)
            <input v-model.number="examForm.inicioMax" type="number" min="0" step="1" required />
          </label>
          <label>
            Proceso (menor que)
            <input v-model.number="examForm.procesoMax" type="number" min="0" step="1" required />
          </label>
        </div>
        <p class="muted">
          Escala: Inicio &lt; {{ examForm.inicioMax }} ·
          Proceso {{ examForm.inicioMax }}–{{ examForm.procesoMax - 1 }} ·
          Logrado ≥ {{ examForm.procesoMax }}
        </p>

        <div class="stack full-width">
          <article v-if="currentQuestion" class="sub-card question-card">
            <header class="row-between">
              <strong>Pregunta {{ currentQuestionIndex + 1 }} de {{ questionCount }}</strong>
              <div class="actions">
                <button type="button" class="small" :disabled="!hasPreviousQuestion" @click="previousQuestion">Atrás</button>
                <button type="button" class="small" :disabled="!hasNextQuestion" @click="nextQuestion">Siguiente</button>
                <button type="button" class="small" @click="removeQuestion(currentQuestion.id)">Eliminar</button>
              </div>
            </header>

            <div class="grid-form">
              <label>
                Tipo
                <select :value="currentQuestion.type" @change="updateType(currentQuestion, ($event.target as HTMLSelectElement).value as QuestionType)">
                  <option value="mcq">Opción múltiple</option>
                  <option value="free">Respuesta libre</option>
                </select>
              </label>
              <label>
                Puntaje
                <input v-model.number="currentQuestion.points" type="number" min="1" step="0.25" required />
              </label>
            </div>

            <label v-if="currentQuestion.type === 'mcq'">
              Alternativa correcta
              <div class="choice-group">
                <label v-for="option in multipleChoiceOptions" :key="`${currentQuestion.id}-${option}`" class="choice-pill">
                  <input
                    v-model="currentQuestion.correctAnswer"
                    type="radio"
                    :name="`correct-${currentQuestion.id}`"
                    :value="option"
                    required
                    @change="hasNextQuestion ? nextQuestion() : undefined"
                  />
                  <span>{{ option }}</span>
                </label>
              </div>
            </label>

            <div class="stack">
              <h4>Vista general de marcaciones</h4>
              <div class="question-overview-grid">
                <button
                  v-for="item in questionOverview"
                  :key="item.id"
                  type="button"
                  class="question-overview-btn"
                  :class="{ active: item.index === currentQuestionIndex, marked: item.isMarked }"
                  @click="goToQuestion(item.index)"
                >
                  <span> P{{ item.index + 1 }} </span>
                  <strong>{{ item.value }}</strong>
                </button>
              </div>
            </div>
          </article>
        </div>

        <div class="actions full-width">
          <button type="button" @click="addQuestion">Agregar pregunta</button>
          <button type="submit">{{ editingExamId ? 'Actualizar examen' : 'Guardar examen' }}</button>
          <button v-if="editingExamId" type="button" class="small" @click="resetForm">Cancelar edición</button>
        </div>
      </form>
    </article>

    <article class="card">
      <h3>Exámenes creados</h3>
      <ul v-if="store.exams.length" class="clean-list">
        <li v-for="exam in store.exams" :key="exam.id" class="list-row">
          <span class="list-main">
            <span class="list-title">{{ exam.title }}</span>
            <small class="muted list-meta">{{ exam.questions.length }} preguntas</small>
          </span>
          <div class="actions">
            <small>{{ exam.year }}</small>
            <button type="button" class="small icon-btn" @click="exportExamExcel(exam.id)">
              <span class="btn-icon" aria-hidden="true">⇩</span>
              <span class="btn-text">Excel</span>
            </button>
            <button type="button" class="small icon-btn" @click="startEditExam(exam.id)">
              <span class="btn-icon" aria-hidden="true">✎</span>
              <span class="btn-text">Editar</span>
            </button>
            <button type="button" class="small danger icon-btn" @click="deleteExam(exam.id)">
              <span class="btn-icon" aria-hidden="true">🗑</span>
              <span class="btn-text">Eliminar</span>
            </button>
          </div>
        </li>
      </ul>
      <p v-else class="muted">Aún no hay exámenes.</p>
    </article>
  </section>
</template>
