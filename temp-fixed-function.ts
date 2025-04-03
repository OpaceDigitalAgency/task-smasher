const handleGenerateIdeas = async () => {
    try {
      // Use OpenAIService to make the request through the proxy
      const { data, rateLimit } = await OpenAIService.createChatCompletion({
        model: selectedModel,
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant that generates creative task ideas. Return a list of 5 task ideas, one per line, no numbers or bullets.'
          },
          {
            role: 'user',
            content: `Generate 5 task ideas for ${selectedUseCase || 'general productivity'}`
          }
        ]
      });
      
      // Update rate limit status
      if (rateLimit.remaining === 0) {
        setRateLimited(true);
      }
      
      if (data.choices && data.choices[0]) {
        // Parse the response into an array of ideas
        const responseText = data.choices[0].message.content;
        const ideas = responseText
          .split('\n')
          .filter(line => line.trim().length > 0)
          .map(line => line.replace(/^\d+\.\s*|-\s*|\*\s*/, '').trim());
        
        setHistory(prev => [...prev, boards]);
        
        setBoards(prevBoards => {
          const todoBoard = prevBoards.find(board => board.id === 'todo');
          if (!todoBoard) return prevBoards;

          return prevBoards.map(board => 
            board.id === 'todo' 
              ? { 
                  ...board, 
                  tasks: [
                    ...board.tasks, 
                    ...ideas.map((idea, index) => ({
                      id: `task-${Date.now()}-${index}`,
                      title: idea,
                      subtasks: [],
                      completed: false,
                      priority: 'medium',
                      estimatedTime: 1,
                      expanded: false,
                      boardId: 'todo'
                    }))
                  ] 
                }
              : board
          );
        });

        setTotalCost(prev => prev + (data.usage?.total_tokens || 0) * 0.000002);
        setExecutionCount(prev => prev + 1);
      }
    } catch (error) {
      console.error('Error generating ideas:', error);
      
      // Check if the error is due to rate limiting
      if (error instanceof Error && error.message.includes('Rate limit exceeded')) {
        setRateLimited(true);
        alert('Rate limit exceeded. Please try again later.');
      }
    }
  };