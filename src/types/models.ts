export type EnrollmentStatus = 'active' | 'withdrawn'

export interface SchoolYear {
    id: string
    year: number
}

export interface Classroom {
    id: string
    name: string
    grade: number
    section: string
    year: number
    createdAt: string
}

export interface Student {
    id: string
    fullName: string
    createdAt: string
}

export interface Enrollment {
    id: string
    classroomId: string
    studentId: string
    status: EnrollmentStatus
    statusUpdatedAt: string
}

export type QuestionType = 'mcq' | 'free'

export interface ExamQuestion {
    id: string
    prompt: string
    type: QuestionType
    points: number
    correctAnswer?: string
    options?: string[]
    correctOptionIndex?: number
}

export interface Exam {
    id: string
    title: string
    classroomId: string
    year: number
    createdAt: string
    questions: ExamQuestion[]
}

export interface StudentAnswer {
    questionId: string
    selectedText?: string
    selectedOptionIndex?: number
    freeScore?: number
}

export interface ExamResult {
    id: string
    examId: string
    classroomId: string
    studentId: string
    answers: StudentAnswer[]
    rawScore: number
    maxRawScore: number
    finalScore: number
    updatedAt: string
}

export interface PromotionRecord {
    id: string
    fromClassroomId: string
    toClassroomId: string
    studentId: string
    createdAt: string
}

export interface AppData {
    version: number
    classrooms: Classroom[]
    students: Student[]
    enrollments: Enrollment[]
    exams: Exam[]
    results: ExamResult[]
    promotions: PromotionRecord[]
}
