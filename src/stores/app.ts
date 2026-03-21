import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'
import type {
    AppData,
    Classroom,
    Enrollment,
    EnrollmentStatus,
    Exam,
    ExamQuestion,
    ExamResult,
    PromotionRecord,
    Student,
    StudentAnswer,
} from '../types/models'
import { createId } from '../utils/ids'
import { calculateRawScore, getExamMaxRawScore, getPassFail, normalizeScore } from '../utils/grading'
import { getDefaultData, loadFromStorage, replaceStorage, saveToStorage } from '../utils/storage'

function now(): string {
    return new Date().toISOString()
}

export const useAppStore = defineStore('app', () => {
    const data = ref<AppData>(loadFromStorage())

    watch(
        data,
        (nextData) => {
            saveToStorage(nextData)
        },
        { deep: true },
    )

    const classrooms = computed(() => data.value.classrooms)
    const students = computed(() => data.value.students)
    const enrollments = computed(() => data.value.enrollments)
    const exams = computed(() => data.value.exams)
    const results = computed(() => data.value.results)

    function createClassroom(input: { grade: number; section: string; year: number }): Classroom {
        const classroom: Classroom = {
            id: createId('class'),
            name: `${input.grade}° ${input.section} - ${input.year}`,
            grade: input.grade,
            section: input.section,
            year: input.year,
            createdAt: now(),
        }

        data.value.classrooms.push(classroom)
        return classroom
    }

    function updateClassroom(classroomId: string, input: { grade: number; section: string; year: number }): void {
        const classroom = data.value.classrooms.find((item) => item.id === classroomId)

        if (!classroom) {
            return
        }

        classroom.grade = Number(input.grade)
        classroom.section = input.section.trim().toUpperCase()
        classroom.year = Number(input.year)
        classroom.name = `${classroom.grade}° ${classroom.section} - ${classroom.year}`
    }

    function deleteClassroom(classroomId: string): void {
        data.value.classrooms = data.value.classrooms.filter((item) => item.id !== classroomId)
        data.value.enrollments = data.value.enrollments.filter((item) => item.classroomId !== classroomId)

        const removedExamIds = new Set(
            data.value.exams.filter((item) => item.classroomId === classroomId).map((item) => item.id),
        )

        data.value.exams = data.value.exams.filter((item) => item.classroomId !== classroomId)
        data.value.results = data.value.results.filter(
            (item) => item.classroomId !== classroomId && !removedExamIds.has(item.examId),
        )
        data.value.promotions = data.value.promotions.filter(
            (item) => item.fromClassroomId !== classroomId && item.toClassroomId !== classroomId,
        )
    }

    function addStudentToClassroom(classroomId: string, fullName: string): Student | null {
        const trimmedName = fullName.trim()
        if (!trimmedName) {
            return null
        }

        let student = data.value.students.find((item) => item.fullName.toLowerCase() === trimmedName.toLowerCase())

        if (!student) {
            student = {
                id: createId('stu'),
                fullName: trimmedName,
                createdAt: now(),
            }
            data.value.students.push(student)
        }

        const alreadyEnrolled = data.value.enrollments.some(
            (item) => item.classroomId === classroomId && item.studentId === student.id,
        )

        if (!alreadyEnrolled) {
            const enrollment: Enrollment = {
                id: createId('enr'),
                classroomId,
                studentId: student.id,
                status: 'active',
                statusUpdatedAt: now(),
            }
            data.value.enrollments.push(enrollment)
        }

        return student
    }

    function setEnrollmentStatus(enrollmentId: string, status: EnrollmentStatus): void {
        const enrollment = data.value.enrollments.find((item) => item.id === enrollmentId)

        if (!enrollment) {
            return
        }

        enrollment.status = status
        enrollment.statusUpdatedAt = now()
    }

    function updateStudentName(studentId: string, fullName: string): void {
        const student = data.value.students.find((item) => item.id === studentId)

        if (!student) {
            return
        }

        const trimmedName = fullName.trim()
        if (!trimmedName) {
            return
        }

        student.fullName = trimmedName
    }

    function removeEnrollment(enrollmentId: string): void {
        const enrollment = data.value.enrollments.find((item) => item.id === enrollmentId)

        if (!enrollment) {
            return
        }

        data.value.enrollments = data.value.enrollments.filter((item) => item.id !== enrollmentId)
        data.value.results = data.value.results.filter(
            (item) => !(item.classroomId === enrollment.classroomId && item.studentId === enrollment.studentId),
        )

        const studentStillEnrolled = data.value.enrollments.some((item) => item.studentId === enrollment.studentId)
        if (!studentStillEnrolled) {
            data.value.students = data.value.students.filter((item) => item.id !== enrollment.studentId)
        }
    }

    function getClassroomStudents(classroomId: string): Array<{
        enrollment: Enrollment
        student: Student
        resultCount: number
    }> {
        return data.value.enrollments
            .filter((enrollment) => enrollment.classroomId === classroomId)
            .map((enrollment) => {
                const student = data.value.students.find((item) => item.id === enrollment.studentId)

                if (!student) {
                    return null
                }

                const resultCount = data.value.results.filter(
                    (result) => result.classroomId === classroomId && result.studentId === student.id,
                ).length

                return { enrollment, student, resultCount }
            })
            .filter((item): item is { enrollment: Enrollment; student: Student; resultCount: number } => Boolean(item))
            .sort((a, b) => a.student.fullName.localeCompare(b.student.fullName))
    }

    function createExam(input: { title: string; classroomId: string; questions: ExamQuestion[] }): Exam | null {
        const classroom = data.value.classrooms.find((item) => item.id === input.classroomId)

        if (!classroom || !input.title.trim() || input.questions.length === 0) {
            return null
        }

        const exam: Exam = {
            id: createId('exam'),
            title: input.title.trim(),
            classroomId: input.classroomId,
            year: classroom.year,
            createdAt: now(),
            questions: input.questions,
        }

        data.value.exams.push(exam)
        return exam
    }

    function updateExam(examId: string, input: { title: string; classroomId: string; questions: ExamQuestion[] }): void {
        const exam = data.value.exams.find((item) => item.id === examId)
        const classroom = data.value.classrooms.find((item) => item.id === input.classroomId)

        if (!exam || !classroom || !input.title.trim() || input.questions.length === 0) {
            return
        }

        exam.title = input.title.trim()
        exam.classroomId = input.classroomId
        exam.year = classroom.year
        exam.questions = input.questions

        for (const result of data.value.results.filter((item) => item.examId === exam.id)) {
            const maxRawScore = getExamMaxRawScore(exam)
            const rawScore = calculateRawScore(exam, result.answers)
            result.rawScore = normalizeScore(rawScore)
            result.maxRawScore = maxRawScore
            result.finalScore = normalizeScore(rawScore)
            result.updatedAt = now()
        }
    }

    function deleteExam(examId: string): void {
        data.value.exams = data.value.exams.filter((item) => item.id !== examId)
        data.value.results = data.value.results.filter((item) => item.examId !== examId)
    }

    function getExamById(examId: string): Exam | undefined {
        return data.value.exams.find((exam) => exam.id === examId)
    }

    function getResult(examId: string, studentId: string): ExamResult | undefined {
        return data.value.results.find((result) => result.examId === examId && result.studentId === studentId)
    }

    function saveResult(input: {
        examId: string
        classroomId: string
        studentId: string
        answers: StudentAnswer[]
    }): ExamResult | null {
        const exam = getExamById(input.examId)

        if (!exam) {
            return null
        }

        const maxRawScore = getExamMaxRawScore(exam)
        const rawScore = normalizeScore(calculateRawScore(exam, input.answers))
        const finalScore = normalizeScore(rawScore)

        const existingResult = getResult(input.examId, input.studentId)

        if (existingResult) {
            existingResult.answers = input.answers
            existingResult.rawScore = rawScore
            existingResult.maxRawScore = maxRawScore
            existingResult.finalScore = finalScore
            existingResult.updatedAt = now()
            return existingResult
        }

        const result: ExamResult = {
            id: createId('res'),
            examId: input.examId,
            classroomId: input.classroomId,
            studentId: input.studentId,
            answers: input.answers,
            rawScore,
            maxRawScore,
            finalScore,
            updatedAt: now(),
        }

        data.value.results.push(result)
        return result
    }

    function getExamProgress(examId: string): { graded: number; totalActive: number } {
        const exam = getExamById(examId)

        if (!exam) {
            return { graded: 0, totalActive: 0 }
        }

        const activeEnrollments = data.value.enrollments.filter(
            (enrollment) => enrollment.classroomId === exam.classroomId && enrollment.status === 'active',
        )

        const graded = data.value.results.filter((result) => result.examId === examId).length

        return {
            graded,
            totalActive: activeEnrollments.length,
        }
    }

    function promoteStudents(input: {
        fromClassroomId: string
        targetYear: number
        studentIds: string[]
    }): { classroom: Classroom; moved: number } | null {
        const fromClassroom = data.value.classrooms.find((item) => item.id === input.fromClassroomId)

        if (!fromClassroom || input.studentIds.length === 0) {
            return null
        }

        const targetClassroom = createClassroom({
            grade: fromClassroom.grade + 1,
            section: fromClassroom.section,
            year: input.targetYear,
        })

        let moved = 0

        for (const studentId of input.studentIds) {
            const sourceEnrollment = data.value.enrollments.find(
                (enrollment) =>
                    enrollment.classroomId === fromClassroom.id &&
                    enrollment.studentId === studentId &&
                    enrollment.status === 'active',
            )

            if (!sourceEnrollment) {
                continue
            }

            const promotion: PromotionRecord = {
                id: createId('pro'),
                fromClassroomId: fromClassroom.id,
                toClassroomId: targetClassroom.id,
                studentId,
                createdAt: now(),
            }
            data.value.promotions.push(promotion)

            data.value.enrollments.push({
                id: createId('enr'),
                classroomId: targetClassroom.id,
                studentId,
                status: 'active',
                statusUpdatedAt: now(),
            })

            moved += 1
        }

        return {
            classroom: targetClassroom,
            moved,
        }
    }

    function exportJson(): string {
        return JSON.stringify(data.value, null, 2)
    }

    function importJson(raw: string, mode: 'replace' | 'merge'): { ok: boolean; message: string } {
        try {
            const incoming = JSON.parse(raw) as Partial<AppData>

            if (!incoming || !Array.isArray(incoming.classrooms) || !Array.isArray(incoming.exams)) {
                return { ok: false, message: 'El archivo no tiene un formato válido.' }
            }

            const normalized: AppData = {
                version: incoming.version ?? 1,
                classrooms: incoming.classrooms ?? [],
                students: incoming.students ?? [],
                enrollments: incoming.enrollments ?? [],
                exams: incoming.exams ?? [],
                results: incoming.results ?? [],
                promotions: incoming.promotions ?? [],
            }

            if (mode === 'replace') {
                data.value = normalized
                replaceStorage(normalized)
                return { ok: true, message: 'Datos reemplazados correctamente.' }
            }

            const classroomIds = new Set(data.value.classrooms.map((item) => item.id))
            const studentIds = new Set(data.value.students.map((item) => item.id))
            const enrollmentIds = new Set(data.value.enrollments.map((item) => item.id))
            const examIds = new Set(data.value.exams.map((item) => item.id))
            const resultIds = new Set(data.value.results.map((item) => item.id))
            const promotionIds = new Set(data.value.promotions.map((item) => item.id))

            data.value.classrooms.push(...normalized.classrooms.filter((item) => !classroomIds.has(item.id)))
            data.value.students.push(...normalized.students.filter((item) => !studentIds.has(item.id)))
            data.value.enrollments.push(...normalized.enrollments.filter((item) => !enrollmentIds.has(item.id)))
            data.value.exams.push(...normalized.exams.filter((item) => !examIds.has(item.id)))
            data.value.results.push(...normalized.results.filter((item) => !resultIds.has(item.id)))
            data.value.promotions.push(...normalized.promotions.filter((item) => !promotionIds.has(item.id)))

            return { ok: true, message: 'Datos fusionados correctamente.' }
        } catch {
            return { ok: false, message: 'No se pudo leer el archivo JSON.' }
        }
    }

    function exportGradesCsv(): string {
        const header = 'Aula,Examen,Alumno,Puntaje,Maximo,Estado,Actualizado\n'

        const rows = data.value.results.map((result) => {
            const classroom = data.value.classrooms.find((item) => item.id === result.classroomId)
            const exam = data.value.exams.find((item) => item.id === result.examId)
            const student = data.value.students.find((item) => item.id === result.studentId)

            const state = getPassFail(result.rawScore, result.maxRawScore)

            const values = [
                classroom?.name ?? '',
                exam?.title ?? '',
                student?.fullName ?? '',
                result.rawScore.toString(),
                result.maxRawScore.toString(),
                state,
                result.updatedAt,
            ]

            return values.map((value) => `"${value.replaceAll('"', '""')}"`).join(',')
        })

        return header + rows.join('\n')
    }

    function resetAll(): void {
        data.value = getDefaultData()
        replaceStorage(data.value)
    }

    return {
        data,
        classrooms,
        students,
        enrollments,
        exams,
        results,
        createClassroom,
        updateClassroom,
        deleteClassroom,
        addStudentToClassroom,
        updateStudentName,
        removeEnrollment,
        setEnrollmentStatus,
        getClassroomStudents,
        createExam,
        updateExam,
        deleteExam,
        getExamById,
        getResult,
        saveResult,
        getExamProgress,
        promoteStudents,
        exportJson,
        importJson,
        exportGradesCsv,
        resetAll,
    }
})
