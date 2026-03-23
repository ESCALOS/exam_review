<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import type { StudentAnswer } from '../types/models'
import { calculateRawScore, getDefaultScaleConfig, getExamMaxRawScore, getScaleLabel, normalizeScore } from '../utils/grading'
import { useAppStore } from '../stores/app'

const store = useAppStore()

const selectedExamId = ref('')
const currentIndex = ref(0)
const currentQuestionIndex = ref(0)
const answers = reactive<Record<string, StudentAnswer>>({})
const savedMessage = ref('')
const multipleChoiceOptions = ['A', 'B', 'C', 'D', 'E'] as const
const answeredState = reactive<Record<string, boolean>>({})
const isHydrating = ref(false)
let autoSaveTimer: ReturnType<typeof setTimeout> | null = null

function normalizeChoice(value: string | undefined): string {
  const normalized = (value ?? '').trim().toUpperCase()
  return multipleChoiceOptions.includes(normalized as (typeof multipleChoiceOptions)[number]) ? normalized : ''
}

const selectedExam = computed(() => store.getExamById(selectedExamId.value))
const classroomStudents = computed(() => {
  const exam = selectedExam.value

  if (!exam) {
    return []
  }

  return store
    .getClassroomStudents(exam.classroomId)
    .filter((item) => item.enrollment.status === 'active')
})

const currentStudent = computed(() => classroomStudents.value[currentIndex.value])
const currentQuestion = computed(() => {
  const exam = selectedExam.value

  if (!exam || exam.questions.length === 0) {
    return undefined
  }

  return exam.questions[currentQuestionIndex.value]
})

const questionCount = computed(() => selectedExam.value?.questions.length ?? 0)
const hasPreviousQuestion = computed(() => currentQuestionIndex.value > 0)
const hasNextQuestion = computed(() => {
  if (!selectedExam.value) {
    return false
  }

  return currentQuestionIndex.value < selectedExam.value.questions.length - 1
})

const progress = computed(() => {
  if (!selectedExam.value) {
    return { graded: 0, totalActive: 0 }
  }

  return store.getExamProgress(selectedExam.value.id)
})

const previewScore = computed(() => {
  const exam = selectedExam.value

  if (!exam) {
    return 0
  }

  const answerArray = Object.values(answers)
  const raw = calculateRawScore(exam, answerArray)

  return normalizeScore(raw)
})

const previewMaxScore = computed(() => {
  if (!selectedExam.value) {
    return 0
  }

  return getExamMaxRawScore(selectedExam.value)
})

const previewScaleConfig = computed(() => {
  const exam = selectedExam.value
  if (!exam) {
    return getDefaultScaleConfig(0)
  }
  return exam.scaleConfig ?? getDefaultScaleConfig(previewMaxScore.value)
})

const previewScaleLabel = computed(() => {
  return getScaleLabel(previewScore.value, previewScaleConfig.value)
})

const questionOverview = computed(() => {
  const exam = selectedExam.value

  if (!exam) {
    return []
  }

  return exam.questions.map((question, index) => {
    const answer = answers[question.id]
    const isMarked = Boolean(answeredState[question.id])

    let value = '-'
    if (question.type === 'mcq') {
      value = normalizeChoice(answer?.selectedText) || '-'
    } else {
      value = isMarked ? Number(answer?.freeScore ?? 0).toFixed(2) : '-'
    }

    return {
      id: question.id,
      index,
      isMarked,
      value,
    }
  })
})

watch(
  [selectedExamId, currentIndex],
  () => {
    currentQuestionIndex.value = 0
    loadCurrentStudentAnswers()
  },
  { immediate: true },
)

watch(classroomStudents, (students) => {
  if (students.length === 0) {
    currentIndex.value = 0
    return
  }

  if (currentIndex.value >= students.length) {
    currentIndex.value = students.length - 1
  }
})

watch(selectedExam, (exam) => {
  if (!exam) {
    currentQuestionIndex.value = 0
    return
  }

  if (currentQuestionIndex.value >= exam.questions.length) {
    currentQuestionIndex.value = Math.max(0, exam.questions.length - 1)
  }
})

function formatCurrentTime(): string {
  return new Intl.DateTimeFormat('es-PE', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date())
}

function setQuestionMarked(questionId: string, marked: boolean): void {
  answeredState[questionId] = marked
}

function loadCurrentStudentAnswers(): void {
  isHydrating.value = true
  savedMessage.value = ''

  if (autoSaveTimer) {
    clearTimeout(autoSaveTimer)
    autoSaveTimer = null
  }

  const exam = selectedExam.value
  const student = currentStudent.value?.student

  for (const key of Object.keys(answers)) {
    delete answers[key]
  }

  for (const key of Object.keys(answeredState)) {
    delete answeredState[key]
  }

  if (!exam || !student) {
    isHydrating.value = false
    return
  }

  const existingResult = store.getResult(exam.id, student.id)

  if (!existingResult) {
    for (const question of exam.questions) {
      answers[question.id] = {
        questionId: question.id,
        selectedText: '',
        selectedOptionIndex: undefined,
        freeScore: 0,
      }
      answeredState[question.id] = false
    }
    isHydrating.value = false
    return
  }

  for (const answer of existingResult.answers) {
    answers[answer.questionId] = {
      questionId: answer.questionId,
      selectedText: normalizeChoice(answer.selectedText),
      selectedOptionIndex: answer.selectedOptionIndex,
      freeScore: answer.freeScore ?? 0,
    }
    answeredState[answer.questionId] =
      normalizeChoice(answer.selectedText).length > 0 ||
      answer.selectedOptionIndex !== undefined ||
      answer.freeScore !== undefined
  }

  for (const question of exam.questions) {
    if (!answers[question.id]) {
      answers[question.id] = {
        questionId: question.id,
        selectedText: '',
        selectedOptionIndex: undefined,
        freeScore: 0,
      }
      answeredState[question.id] = false
    } else if (answeredState[question.id] === undefined) {
      answeredState[question.id] = false
    }
  }

  isHydrating.value = false
}

function saveCurrent(options?: { silent?: boolean }): boolean {
  const exam = selectedExam.value
  const student = currentStudent.value?.student

  if (!exam || !student) {
    return false
  }

  const payload = exam.questions.map((question) => {
    const answer = answers[question.id]

    if (question.type === 'mcq') {
      return {
        questionId: question.id,
        selectedText: normalizeChoice(answer?.selectedText),
        selectedOptionIndex: answer?.selectedOptionIndex,
      }
    }

    return {
      questionId: question.id,
      freeScore: Number(answer?.freeScore ?? 0),
    }
  })

  store.saveResult({
    examId: exam.id,
    classroomId: exam.classroomId,
    studentId: student.id,
    answers: payload,
  })

  if (options?.silent) {
    savedMessage.value = `Guardado automático: ${formatCurrentTime()}`
    return true
  }

  savedMessage.value = `Guardado para ${student.fullName}. Puntaje: ${previewScore.value}/${previewMaxScore.value}`
  return true
}

function scheduleAutoSave(): void {
  if (isHydrating.value) {
    return
  }

  if (autoSaveTimer) {
    clearTimeout(autoSaveTimer)
  }

  autoSaveTimer = setTimeout(() => {
    saveCurrent({ silent: true })
  }, 250)
}

function goToQuestion(index: number): void {
  const total = questionCount.value
  if (total === 0) {
    currentQuestionIndex.value = 0
    return
  }

  currentQuestionIndex.value = Math.min(Math.max(index, 0), total - 1)
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

function moveToNextQuestionIfPossible(): void {
  if (hasNextQuestion.value) {
    nextQuestion()
  }
}

function onSelectChoice(questionId: string): void {
  const selected = normalizeChoice(answers[questionId]?.selectedText)
  answers[questionId].selectedText = selected
  setQuestionMarked(questionId, selected.length > 0)
  scheduleAutoSave()
  moveToNextQuestionIfPossible()
}

function clearChoice(questionId: string): void {
  answers[questionId].selectedText = ''
  answers[questionId].selectedOptionIndex = undefined
  setQuestionMarked(questionId, false)
  scheduleAutoSave()
}

function onFreeScoreInput(questionId: string): void {
  const value = Number(answers[questionId]?.freeScore ?? 0)
  answers[questionId].freeScore = value
  setQuestionMarked(questionId, true)
  scheduleAutoSave()
}

function onFreeScoreEnter(questionId: string): void {
  onFreeScoreInput(questionId)
  moveToNextQuestionIfPossible()
}

function previousStudent(): void {
  if (currentIndex.value > 0) {
    currentIndex.value -= 1
  }
}

function nextStudent(): void {
  if (currentIndex.value < classroomStudents.value.length - 1) {
    currentIndex.value += 1
  }
}
</script>

<template>
  <section class="panel">
    <h1>Calificar examen</h1>

    <article class="card">
      <label>
        Examen
        <select v-model="selectedExamId">
          <option value="">Seleccionar</option>
          <option v-for="exam in store.exams" :key="exam.id" :value="exam.id">
            {{ exam.title }} - {{ exam.year }}
          </option>
        </select>
      </label>

      <p v-if="selectedExam" class="muted">
        Progreso: {{ progress.graded }} / {{ progress.totalActive }} alumnos con calificación
      </p>
    </article>

    <article v-if="selectedExam && currentStudent" class="card grading-layout">
      <div>
        <header class="row-between">
          <h3>
            {{ currentStudent.student.fullName }}
            ({{ currentIndex + 1 }}/{{ classroomStudents.length }})
          </h3>
          <div class="actions">
            <button type="button" class="small" @click="previousStudent">Anterior</button>
            <button type="button" class="small" @click="nextStudent">Siguiente</button>
          </div>
        </header>

        <article v-if="currentQuestion" class="sub-card question-card">
          <header class="row-between">
            <div>
              <p><strong>Pregunta {{ currentQuestionIndex + 1 }} de {{ questionCount }}</strong></p>
              <p class="muted">Puntaje: {{ currentQuestion.points }}</p>
            </div>
            <div class="actions">
              <button type="button" class="small" :disabled="!hasPreviousQuestion" @click="previousQuestion">Atrás</button>
              <button type="button" class="small" :disabled="!hasNextQuestion" @click="nextQuestion">Siguiente</button>
            </div>
          </header>

          <p>{{ currentQuestion.prompt }}</p>

          <div v-if="currentQuestion.type === 'mcq'" class="stack">
            <label>
              Respuesta marcada por el alumno
              <div class="choice-group">
                <label
                  v-for="option in multipleChoiceOptions"
                  :key="`student-${currentStudent.student.id}-${currentQuestion.id}-${option}`"
                  class="choice-pill"
                >
                  <input
                    v-model="answers[currentQuestion.id].selectedText"
                    type="radio"
                    :name="`answer-${currentStudent.student.id}-${currentQuestion.id}`"
                    :value="option"
                    @change="onSelectChoice(currentQuestion.id)"
                  />
                  <span>{{ option }}</span>
                </label>

                <button
                  type="button"
                  class="small"
                  @click="clearChoice(currentQuestion.id)"
                >
                  Limpiar
                </button>
              </div>
            </label>
            <p class="muted">Correcta: {{ currentQuestion.correctAnswer }}</p>
          </div>

          <label v-else>
            Puntaje obtenido
            <input
              v-model.number="answers[currentQuestion.id].freeScore"
              type="number"
              min="0"
              :max="currentQuestion.points"
              step="0.25"
              @input="onFreeScoreInput(currentQuestion.id)"
              @keyup.enter="onFreeScoreEnter(currentQuestion.id)"
            />
          </label>
        </article>
      </div>

      <aside class="sub-card sticky">
        <h3>Resultado instantáneo</h3>
        <p class="score">{{ previewScore.toFixed(2) }} / {{ previewMaxScore.toFixed(2) }}</p>
        <p class="muted">{{ previewScaleLabel }}</p>

        <div class="stack">
          <h4>Resumen de marcaciones</h4>
          <div class="question-overview-grid">
            <button
              v-for="item in questionOverview"
              :key="item.id"
              type="button"
              class="question-overview-btn"
              :class="{
                active: item.index === currentQuestionIndex,
                marked: item.isMarked,
              }"
              @click="goToQuestion(item.index)"
            >
              <span> P{{ item.index + 1 }} </span>
              <strong>{{ item.value }}</strong>
            </button>
          </div>
          <p class="muted">{{ savedMessage }}</p>
        </div>
      </aside>
    </article>

    <article v-else-if="selectedExam" class="card">
      <p class="muted">No hay alumnos activos en esta aula.</p>
    </article>

    <article v-else class="card">
      <p class="muted">Selecciona un examen para iniciar la calificación.</p>
    </article>
  </section>
</template>
