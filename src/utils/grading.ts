import type { Exam, StudentAnswer } from '../types/models'

export function getExamMaxRawScore(exam: Exam): number {
    return exam.questions.reduce((sum, question) => sum + question.points, 0)
}

export function calculateRawScore(exam: Exam, answers: StudentAnswer[]): number {
    const answersByQuestionId = new Map(answers.map((answer) => [answer.questionId, answer]))

    return exam.questions.reduce((sum, question) => {
        const answer = answersByQuestionId.get(question.id)

        if (!answer) {
            return sum
        }

        if (question.type === 'mcq') {
            const expected = (question.correctAnswer ?? '').trim().toLowerCase()
            const actual = (answer.selectedText ?? '').trim().toLowerCase()

            if (expected && actual === expected) {
                return sum + question.points
            }

            if (question.correctOptionIndex !== undefined && answer.selectedOptionIndex !== undefined) {
                return sum + (answer.selectedOptionIndex === question.correctOptionIndex ? question.points : 0)
            }

            return sum
        }

        const freeScore = Number(answer.freeScore ?? 0)
        const boundedScore = Math.max(0, Math.min(question.points, freeScore))
        return sum + boundedScore
    }, 0)
}

export function normalizeScore(rawScore: number): number {
    return Math.round(rawScore * 100) / 100
}

export function getPassFail(rawScore: number, maxRawScore: number): 'Aprobado' | 'Desaprobado' {
    if (maxRawScore <= 0) {
        return 'Desaprobado'
    }

    const ratio = rawScore / maxRawScore
    return ratio >= 0.55 ? 'Aprobado' : 'Desaprobado'
}
