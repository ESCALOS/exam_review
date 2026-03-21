<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import type { StudentAnswer } from '../types/models'
import { calculateRawScore, getExamMaxRawScore, getPassFail, normalizeScore } from '../utils/grading'
import { useAppStore } from '../stores/app'

const store = useAppStore()

const selectedExamId = ref('')
const currentIndex = ref(0)
const answers = reactive<Record<string, StudentAnswer>>({})
const savedMessage = ref('')

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

watch(
  [selectedExamId, currentIndex],
  () => {
    loadCurrentStudentAnswers()
  },
  { immediate: true },
)

function loadCurrentStudentAnswers(): void {
  savedMessage.value = ''

  const exam = selectedExam.value
  const student = currentStudent.value?.student

  for (const key of Object.keys(answers)) {
    delete answers[key]
  }

  if (!exam || !student) {
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
    }
    return
  }

  for (const answer of existingResult.answers) {
    answers[answer.questionId] = {
      questionId: answer.questionId,
      selectedText: answer.selectedText ?? '',
      selectedOptionIndex: answer.selectedOptionIndex,
      freeScore: answer.freeScore ?? 0,
    }
  }

  for (const question of exam.questions) {
    if (!answers[question.id]) {
      answers[question.id] = {
        questionId: question.id,
        selectedText: '',
        selectedOptionIndex: undefined,
        freeScore: 0,
      }
    }
  }
}

function saveCurrent(): void {
  const exam = selectedExam.value
  const student = currentStudent.value?.student

  if (!exam || !student) {
    return
  }

  const payload = exam.questions.map((question) => {
    const answer = answers[question.id]

    if (question.type === 'mcq') {
      return {
        questionId: question.id,
        selectedText: (answer?.selectedText ?? '').trim(),
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

  savedMessage.value = `Guardado para ${student.fullName}. Puntaje: ${previewScore.value}/${previewMaxScore.value}`
}

function saveAndNext(): void {
  saveCurrent()

  if (currentIndex.value < classroomStudents.value.length - 1) {
    currentIndex.value += 1
  }
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

        <div class="stack">
          <article v-for="(question, index) in selectedExam.questions" :key="question.id" class="sub-card">
            <p><strong>{{ index + 1 }}.</strong> {{ question.prompt }}</p>
            <p class="muted">Puntaje: {{ question.points }}</p>

            <div v-if="question.type === 'mcq'" class="stack">
              <label>
                Respuesta marcada por el alumno
                <input
                  v-model="answers[question.id].selectedText"
                  type="text"
                  placeholder="Ejemplo: B"
                />
              </label>
              <p class="muted">Correcta: {{ question.correctAnswer }}</p>
            </div>

            <label v-else>
              Puntaje obtenido
              <input
                v-model.number="answers[question.id].freeScore"
                type="number"
                min="0"
                :max="question.points"
                step="0.25"
              />
            </label>
          </article>
        </div>
      </div>

      <aside class="sub-card sticky">
        <h3>Resultado instantáneo</h3>
        <p class="score">{{ previewScore.toFixed(2) }} / {{ previewMaxScore.toFixed(2) }}</p>
        <p class="muted">{{ getPassFail(previewScore, previewMaxScore) }}</p>

        <div class="stack">
          <button type="button" @click="saveCurrent">Guardar</button>
          <button type="button" @click="saveAndNext">Guardar y siguiente</button>
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
