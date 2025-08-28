'use client'

import { useState, useEffect } from 'react'

interface Message {
  id: string
  content: string
  isUser: boolean
  timestamp: Date
}

interface Character {
  id: string
  name: string
  description: string
}

// 生成UUID函数
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0
    const v = c == 'x' ? r : (r & 0x3 | 0x8)
    return v.toString(16)
  })
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([])
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [userId, setUserId] = useState<string>('')
  const [selectedCharacter, setSelectedCharacter] = useState<string>('')
  const [showSetup, setShowSetup] = useState(true)
  const [testMode, setTestMode] = useState(true) // 默认启用测试模式

  // SSE 相关状态
  const [streamingStages, setStreamingStages] = useState<{[key: string]: string}>({})
  const [currentStage, setCurrentStage] = useState<string>('')
  const [streamingProgress, setStreamingProgress] = useState<number>(0)
  const [currentSessionId, setCurrentSessionId] = useState<string>('')
  const [eventSource, setEventSource] = useState<EventSource | null>(null)

  // 预设角色数据 (与数据库中的characters表匹配)
  const characters: Character[] = [
    { id: 'introverted_student', name: '内向学生', description: '20岁大学生，害怕说错话被嘲笑，渴望被理解' },
    { id: 'ambitious_youth', name: '上进青年', description: '25岁职场新人，渴望成功但充满焦虑，害怕平庸' },
    { id: 'lonely_artist', name: '孤独艺术家', description: '28岁自由创作者，追求美与真理，现实让人挫败' },
    { id: 'anxious_parent', name: '焦虑家长', description: '35岁父母，担心孩子安全和未来，想给最好但怕不够' }
  ]

  // 生成或获取用户ID
  useEffect(() => {
    let storedUserId = localStorage.getItem('helios_user_id')
    
    // 强制检查UUID格式，如果不是有效UUID则重置
    const isValidUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(storedUserId || '')
    
    if (!storedUserId || !isValidUUID) {
      // 强制使用数据库中存在的测试用户ID
      storedUserId = '6a477327-52ae-4853-afda-4e53d5760ad0'
      localStorage.setItem('helios_user_id', storedUserId)
      console.log('强制更新用户ID为正确UUID格式:', storedUserId)
    }
    setUserId(storedUserId)

    // 检查是否已选择角色
    const storedCharacter = localStorage.getItem('helios_selected_character')
    if (storedCharacter) {
      setSelectedCharacter(storedCharacter)
      setShowSetup(false)
    }
  }, [])

  // 清理EventSource连接
  useEffect(() => {
    return () => {
      if (eventSource) {
        console.log('🔌 组件卸载，关闭EventSource连接')
        eventSource.close()
      }
    }
  }, [eventSource])

  const handleCharacterSelect = (characterId: string) => {
    setSelectedCharacter(characterId)
    localStorage.setItem('helios_selected_character', characterId)
    setShowSetup(false)
  }

  const resetSetup = () => {
    localStorage.removeItem('helios_selected_character')
    setSelectedCharacter('')
    setMessages([])
    setShowSetup(true)
  }

  const resetAllData = () => {
    localStorage.removeItem('helios_selected_character')
    localStorage.removeItem('helios_user_id')
    setSelectedCharacter('')
    setMessages([])
    setUserId('')
    setShowSetup(true)
    // 强制刷新以重新生成用户ID
    window.location.reload()
  }

  // 获取阶段中文标签
  const getStageLabel = (stage: string): string => {
    const stageLabels: {[key: string]: string} = {
      'connected': '连接建立',
      'belief': '信念系统',
      'drive': '内驱力',
      'collective': '集体潜意识',
      'behavior': '外我行为',
      'mind': '头脑解释',
      'reaction': '外我反应',
      'complete': '转化完成'
    }
    return stageLabels[stage] || stage
  }

  const sendMessage = async () => {
    if (!inputValue.trim() || isLoading) return

    const userMessage: Message = {
      id: Date.now().toString(),
      content: inputValue.trim(),
      isUser: true,
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    setInputValue('')
    setIsLoading(true)

    // 重置SSE状态
    setStreamingStages({})
    setCurrentStage('')
    setStreamingProgress(0)

    try {
      // 测试模式 - 模拟角色响应
      if (testMode) {
        const character = characters.find(c => c.id === selectedCharacter)
        const mockResponses = {
          'introverted_student': [
            '我...我想说什么但是又害怕别人觉得我很奇怪...',
            '心里有很多想法，但是说出来会不会被嘲笑呢...',
            '我低下头，感觉脸颊发烫，这种被关注的感觉让我既兴奋又紧张...'
          ],
          'ambitious_youth': [
            '这个机会我一定要抓住！但是内心还是有些焦虑...',
            '别人都比我优秀，我必须更努力才行！',
            '时间不够用，我感到一阵焦虑，但还是要继续前进...'
          ],
          'lonely_artist': [
            '这个世界很少有人能真正理解艺术的意义...',
            '我沉浸在自己的创作世界里，现实总是让人失望...',
            '孤独是创作的源泉，但有时也渴望找到知音...'
          ],
          'anxious_parent': [
            '这样做对孩子好吗？我总是担心自己做得不够...',
            '看到别家孩子这么优秀，我开始反思自己的教育方式...',
            '我的内心充满了对孩子的担忧，这个世界对他来说会不会太危险？'
          ]
        }
        
        const responses = mockResponses[selectedCharacter as keyof typeof mockResponses] || ['角色正在思考中...']
        const mockResponse = responses[Math.floor(Math.random() * responses.length)]
        
        // 模拟网络延迟
        await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000))
        
        const aiMessage: Message = {
          id: (Date.now() + 1).toString(),
          content: `${mockResponse} [测试模式]`,
          isUser: false,
          timestamp: new Date()
        }
        setMessages(prev => [...prev, aiMessage])
        return
      }

      // 使用真正的EventSource进行意识转化流程
      await handleRealSSEConsciousnessFlow(userMessage)

    } catch (error) {
      console.error('发送消息错误:', error)
      handleSendMessageError(error)
    } finally {
      setIsLoading(false)
    }
  }

  // 使用真正的EventSource进行意识转化流程
  const handleRealSSEConsciousnessFlow = async (userMessage: Message) => {
    try {
      // 步骤1: 建立EventSource连接
      const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      setCurrentSessionId(sessionId)

      console.log('🔗 建立EventSource连接:', sessionId)

      const sseUrl = `/api/sse-stream?userId=${userId}&sessionId=${sessionId}`
      const newEventSource = new EventSource(sseUrl)
      setEventSource(newEventSource)

      // 设置EventSource事件监听器
      newEventSource.onopen = () => {
        console.log('✅ EventSource连接已建立')
      }

      newEventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          console.log('📨 收到EventSource消息:', data)
          handleStreamData(data)
        } catch (e) {
          console.error('❌ 解析EventSource数据失败:', e, event.data)
        }
      }

      newEventSource.onerror = (error) => {
        console.error('❌ EventSource连接错误:', error)
        newEventSource.close()
        setEventSource(null)

        // 如果连接失败，显示错误消息
        const errorMessage: Message = {
          id: (Date.now() + 1).toString(),
          content: 'EventSource连接失败，请刷新页面重试',
          isUser: false,
          timestamp: new Date()
        }
        setMessages(prev => [...prev, errorMessage])
      }

      // 等待连接建立
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('EventSource连接超时'))
        }, 5000)

        newEventSource.onopen = () => {
          clearTimeout(timeout)
          console.log('✅ EventSource连接已建立')
          resolve(true)
        }

        newEventSource.onerror = () => {
          clearTimeout(timeout)
          reject(new Error('EventSource连接失败'))
        }
      })

      // 步骤2: 触发意识转化流程
      console.log('🚀 触发意识转化流程')
      const triggerResponse = await fetch('/api/trigger-consciousness', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId,
          userId,
          message: userMessage.content
        })
      })

      if (!triggerResponse.ok) {
        const errorData = await triggerResponse.json()
        throw new Error(`触发意识转化失败: ${errorData.error}`)
      }

      const result = await triggerResponse.json()
      console.log('✅ 意识转化已触发:', result.message)

    } catch (error) {
      console.error('❌ 真正的SSE流程错误:', error)

      // 清理EventSource连接
      if (eventSource) {
        eventSource.close()
        setEventSource(null)
      }

      throw error
    }
  }

  // 处理EventSource流式数据
  const handleStreamData = (data: any) => {
    console.log('📨 处理EventSource数据:', data)

    // 根据消息类型处理不同的事件
    switch (data.type) {
      case 'connection':
        console.log('🔗 EventSource连接确认:', data.message)
        break

      case 'consciousness_start':
        console.log('🧠 意识转化开始:', data.message)
        setStreamingProgress(0)
        setCurrentStage('开始')
        break

      case 'stage_update':
        const stageName = data.stage
        const stageLabel = getStageLabel(stageName)

        setCurrentStage(stageName)
        setStreamingProgress(data.progress || 0)

        if (data.status === 'processing') {
          // 阶段处理中
          setStreamingStages(prev => ({
            ...prev,
            [stageName]: `⏳ ${data.content}`
          }))
        } else if (data.status === 'completed') {
          // 阶段完成
          setStreamingStages(prev => ({
            ...prev,
            [stageName]: data.content
          }))
          console.log(`✅ ${stageLabel}完成:`, data.content)
        } else if (data.status === 'error') {
          // 阶段错误
          setStreamingStages(prev => ({
            ...prev,
            [stageName]: `❌ ${data.content}`
          }))
          console.error(`❌ ${stageLabel}错误:`, data.content)
        }
        break

      case 'session_complete':
        // 整个意识转化流程完成
        console.log('🎉 意识转化完成!')

        const aiMessage: Message = {
          id: (Date.now() + 1).toString(),
          content: data.content,
          isUser: false,
          timestamp: new Date()
        }
        setMessages(prev => [...prev, aiMessage])

        // 关闭EventSource连接
        if (eventSource) {
          eventSource.close()
          setEventSource(null)
        }

        // 清理SSE状态
        setTimeout(() => {
          setStreamingStages({})
          setCurrentStage('')
          setStreamingProgress(0)
          setCurrentSessionId('')
        }, 2000)
        break

      case 'error':
        console.error('❌ 意识转化错误:', data.message)

        const errorMessage: Message = {
          id: (Date.now() + 1).toString(),
          content: `意识转化出现错误: ${data.message}`,
          isUser: false,
          timestamp: new Date()
        }
        setMessages(prev => [...prev, errorMessage])

        // 关闭EventSource连接
        if (eventSource) {
          eventSource.close()
          setEventSource(null)
        }
        break

      default:
        console.log('📨 未知消息类型:', data)
    }
  }

  // 处理发送消息错误
  const handleSendMessageError = (error: any) => {
    let errorText = '抱歉，连接出现问题。'

    // 安全地获取错误信息
    const errorMsg = error instanceof Error ? error.message :
                     typeof error === 'string' ? error :
                     error?.message || '未知错误'

    if (error.name === 'AbortError') {
      errorText = '处理超时，角色可能正在深度思考中。建议启用测试模式体验功能。'
    } else if (errorMsg.includes('Failed to fetch') || errorMsg.includes('fetch failed')) {
      errorText = '无法连接到服务器。请点击右上角启用"测试模式"来体验基本功能。'
    } else if (errorMsg.includes('NetworkError')) {
      errorText = '网络连接问题。建议启用测试模式继续体验。'
    }

    const errorMessage: Message = {
      id: (Date.now() + 1).toString(),
      content: `${errorText} ${!testMode ? '(建议启用右上角的测试模式)' : ''}`,
      isUser: false,
      timestamp: new Date()
    }
    setMessages(prev => [...prev, errorMessage])
  }



  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  if (showSetup) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 text-white">
        <div className="container mx-auto px-4 py-16 max-w-2xl">
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-8">
            <h1 className="text-3xl font-bold text-center mb-4">欢迎来到 Helios</h1>
            <p className="text-center text-gray-300 mb-8">意识的棱镜，信念创造实相</p>

            <div className="mb-6">
              <p className="text-gray-300 mb-2 text-sm">您的意识ID：</p>
              <div className="bg-white/5 rounded-lg p-3 font-mono text-xs text-blue-200">
                {userId}
              </div>
            </div>

            <div className="mb-8">
              <h2 className="text-xl font-semibold mb-2">选择您要探索的意识原型：</h2>
              <p className="text-sm text-gray-400 mb-4">每个角色都有独特的信念系统，将以不同方式感知和创造现实</p>
              <div className="grid gap-4">
                {characters.map((character) => (
                  <button
                    key={character.id}
                    onClick={() => handleCharacterSelect(character.id)}
                    className="bg-white/5 hover:bg-white/10 border border-white/20 rounded-lg p-4 text-left transition-colors"
                  >
                    <h3 className="font-semibold text-lg mb-2">{character.name}</h3>
                    <p className="text-gray-300 text-sm">{character.description}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 text-white">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* 顶部信息栏 */}
        <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 mb-4 flex justify-between items-center">
          <div className="text-sm">
            <span className="text-gray-300">角色：</span>
            <span className="text-blue-200 font-medium">
              {characters.find(c => c.id === selectedCharacter)?.name}
            </span>
            <span className="text-gray-300 ml-4">用户ID：</span>
            <span className="text-blue-200 font-mono text-xs">{userId}</span>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setTestMode(!testMode)}
              className={`px-3 py-1 rounded text-xs ${testMode ? 'bg-orange-600 text-white' : 'bg-white/10 text-gray-300'}`}
            >
              {testMode ? '测试模式 ON' : '测试模式 OFF'}
            </button>
            <button
              onClick={resetSetup}
              className="text-gray-400 hover:text-white text-xs underline"
            >
              重选角色
            </button>
            <button
              onClick={resetAllData}
              className="text-red-400 hover:text-red-300 text-xs underline"
            >
              重置所有数据
            </button>
          </div>
        </div>

        {/* 聊天区域 */}
        <div className="bg-white/10 backdrop-blur-sm rounded-lg h-[65vh] flex flex-col">
          {/* 消息列表 */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {messages.length === 0 ? (
              <div className="text-center text-gray-300 mt-20">
                <h2 className="text-2xl font-bold mb-4">意识棱镜已激活</h2>
                <p className="mb-2">您选择的角色：<span className="text-blue-200 font-medium">{characters.find(c => c.id === selectedCharacter)?.name}</span></p>
                <p className="text-sm mb-4">输入您的意图和想法，观察角色如何通过其独特的信念系统创造现实...</p>
                <div className="text-xs text-gray-400 bg-white/5 rounded-lg p-3 max-w-md mx-auto">
                  <p>💭 <strong>意识层级：</strong> 信念系统 → 内驱力 → 集体潜意识 → 外我行为 → 头脑解释 → 外我反应</p>
                </div>
              </div>
            ) : (
              messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.isUser ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                      message.isUser
                        ? 'bg-blue-600 text-white'
                        : 'bg-white/20 text-gray-100'
                    }`}
                  >
                    <p className="text-sm">{message.content}</p>
                    <p className="text-xs opacity-70 mt-1">
                      {message.timestamp.toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              ))
            )}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-white/20 text-gray-100 max-w-lg px-4 py-3 rounded-lg">
                  <div className="text-sm mb-3">
                    <div className="flex items-center justify-between mb-2">
                      <span>意识转化进行中...</span>
                      <span className="text-xs text-blue-300">{streamingProgress}%</span>
                    </div>

                    {/* 进度条 */}
                    <div className="w-full bg-white/10 rounded-full h-2 mb-3">
                      <div
                        className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full transition-all duration-500"
                        style={{ width: `${streamingProgress}%` }}
                      ></div>
                    </div>

                    {/* 当前阶段指示 */}
                    {currentStage && (
                      <div className="text-xs text-yellow-300 mb-2">
                        <span className="inline-block w-2 h-2 bg-yellow-300 rounded-full mr-2 animate-pulse"></span>
                        当前阶段: {getStageLabel(currentStage)}
                      </div>
                    )}
                  </div>

                  {/* 阶段结果列表 */}
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {Object.entries(streamingStages).map(([stage, content]) => (
                      <div key={stage} className="text-xs">
                        <div className="flex items-start space-x-2">
                          <span className="text-green-400 mt-0.5">
                            {content.startsWith('⏳') ? '⏳' : content.startsWith('❌') ? '❌' : '✓'}
                          </span>
                          <div className="flex-1">
                            <span className="text-blue-200 font-medium">{getStageLabel(stage)}:</span>
                            <div className="text-gray-300 mt-1 text-xs leading-relaxed">
                              {content.replace(/^[⏳❌✓]\s*/, '').substring(0, 100)}
                              {content.length > 100 ? '...' : ''}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 输入区域 */}
          <div className="border-t border-white/20 p-4">
            <div className="flex space-x-2">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="输入您的意图或想法（如：我想变得更自信、我要去找工作、我想表达自己...）"
                className="flex-1 bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-blue-400"
                disabled={isLoading}
              />
              <button
                onClick={sendMessage}
                disabled={!inputValue.trim() || isLoading}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed px-6 py-2 rounded-lg font-medium transition-colors"
              >
                发送
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}