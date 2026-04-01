import express from 'express';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';
import { v4 as uuidv4 } from 'uuid';

const app = express();
const port = process.env.PORT || 3000;

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

app.get('/', (req, res) => {
  res.json({ message: 'Supabase CRUD API 服务运行中' });
});

// data 表相关API（原 data.db）

app.post('/api/data', async (req, res) => {
  const { goals, ...data } = req.body;
  console.log('POST /api/data - 插入数据:', data);

  if (!data._id) {
    data._id = uuidv4();
    console.log('自动生成 _id:', data._id);
  }


  try {
    const { data: newData, error } = await supabase.from('evaluations').insert(data).select();
    goals.map((item)=>{item.evaluation_id=newData[0].id})

    const { data: newDataTwo, errorTwo } = await supabase.from('grades').insert(goals).select();

    if (error) {
      console.error('插入失败:', error);
      return res.status(500).json({ error: 'Failed to add data' });
    }
    console.log('插入成功:', newData);
    res.status(200).json(newData[0]);
  } catch (error) {
    console.error('插入异常:', error);
    res.status(500).json({ error: 'Failed to add data' });
  }
});

app.get('/api/data', async (req, res) => {
  try {
    const { data: evaluations, error: evalError } = await supabase
      .from('evaluations')
      .select(`
        *,
        grades (
        id,
          priority,
          description,
          content,
          risk,
          minimumLevel,
          challengeLevel,
          preliminaryComment,
          selfReview,
          evaluatorComment
        )
      `);

    if (evalError) throw evalError;

    const groupedData = evaluations.reduce((acc, evalItem) => {
      const existing = acc.find(item => item.id === evalItem.id);
      if (existing) {
        existing.goals.push(evalItem.grades);
      } else {
        evalItem.goals = evalItem.grades ? [evalItem.grades] : [];
        delete evalItem.grades;
        acc.push(evalItem);
      }
      return acc;
    }, []);

    res.json(groupedData);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get data' });
  }
});

app.get('/api/data/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const { data: evaluations, error: evalError } = await supabase
      .from('evaluations')
      .select(`
        *,
        grades (
          id,
          priority,
          description,
          content,
          risk,
          minimumLevel,
          challengeLevel,
          preliminaryComment,
          selfReview,
          evaluatorComment
        )
      `)
      .eq('id', id)
      .single();

    if (evalError) {
      return res.status(500).json({ error: 'Failed to get data' });
    }

    if (!evaluations) {
      return res.status(404).json({ error: 'Data not found' });
    }

    const goalsArray = evaluations.grades ? evaluations.grades : [];
    evaluations.goals = goalsArray;
    delete evaluations.grades;

    res.json(evaluations);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get data' });
  }
});

app.put('/api/data/:id', async (req, res) => {
  const { id } = req.params;
  const updateData = { ...req.body };
  console.log(id, updateData);

  try {
    const { data: existingData, error: findError } = await supabase
      .from('evaluations')
      .select('id')
      .eq('_id', id);

    if (findError) {
      console.error('查询失败:', findError);
      return res.status(500).json({ error: 'Failed to find data' });
    }

    if (!existingData || existingData.length === 0) {
      return res.status(404).json({ error: 'Data not found' });
    }

    const evaluationId = existingData[0].id;
    const goals = updateData.goals || [];
    delete updateData.id;
    delete updateData.goals;

    const updatePromises = goals.map(goal => {
      if (goal.id) {
        return supabase
          .from('grades')
          .update(goal)
          .eq('id', goal.id);
      } else {
        return supabase
          .from('grades')
          .insert({
            ...goal,
            evaluation_id: evaluationId
          });
      }
    });

    await Promise.all(updatePromises);

    const { data, error } = await supabase
      .from('evaluations')
      .update(updateData)
      .eq('_id', id)
      .select();

    if (error) {
      console.error('更新失败:', error);
      return res.status(500).json({ error: 'Failed to update data', details: error.message });
    }

    res.json(data[0]);
  } catch (error) {
    console.error('更新异常:', error);
    res.status(500).json({ error: 'Failed to update data', details: error.message });
  }
});

app.delete('/api/data/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const { error } = await supabase.from('evaluations').delete().eq('_id', id);
    if (error) {
      return res.status(500).json({ error: 'Failed to delete data' });
    }
    res.json({ message: 'Data deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete data' });
  }
});

// employees 表相关API（原 employees.db）

app.post('/api/employees', async (req, res) => {
  const data = req.body;
  console.log('POST /api/employees - 插入数据:', data);

  if (!data._id) {
    data._id = uuidv4();
    console.log('自动生成 _id:', data._id);
  }

  try {
    const { data: newData, error } = await supabase.from('employees').insert(data).select();
    if (error) {
      console.error('插入失败:', error);
      return res.status(500).json({ error: 'Failed to add employee data' });
    }
    console.log('插入成功:', newData);
    res.status(200).json(newData[0]);
  } catch (error) {
    console.error('插入异常:', error);
    res.status(500).json({ error: 'Failed to add employee data' });
  }
});

app.get('/api/employees', async (req, res) => {
  console.log('GET /api/employees - 查询所有员工');
  try {
    const { data, error } = await supabase.from('employees').select('*');
    if (error) {
      console.error('查询失败:', error);
      return res.status(500).json({ error: 'Failed to get employee data' });
    }
    console.log('查询结果:', data.length, '条记录');
    res.json(data);
  } catch (error) {
    console.error('查询异常:', error);
    res.status(500).json({ error: 'Failed to get employee data' });
  }
});

function cleanEmployeeData(employee) {
  const cleaned = { ...employee };

  if (cleaned.attendanceRate && typeof cleaned.attendanceRate === 'string') {
    cleaned.attendanceRate = cleaned.attendanceRate.replace('%', '');
  }

  if (cleaned.baseSalary2024 && typeof cleaned.baseSalary2024 === 'string') {
    cleaned.baseSalary2024 = cleaned.baseSalary2024.replace(/,/g, '');
  }

  if (cleaned.salaryMin && typeof cleaned.salaryMin === 'string') {
    cleaned.salaryMin = cleaned.salaryMin.replace(/,/g, '');
  }

  if (cleaned.salaryMid && typeof cleaned.salaryMid === 'string') {
    cleaned.salaryMid = cleaned.salaryMid.replace(/,/g, '');
  }

  if (cleaned.salaryMax && typeof cleaned.salaryMax === 'string') {
    cleaned.salaryMax = cleaned.salaryMax.replace(/,/g, '');
  }

  if (cleaned.basicResource && typeof cleaned.basicResource === 'string') {
    cleaned.basicResource = cleaned.basicResource.replace(/,/g, '');
  }

  if (cleaned.bonusAmount && typeof cleaned.bonusAmount === 'string') {
    cleaned.bonusAmount = cleaned.bonusAmount.replace(/,/g, '');
  }

  return cleaned;
}

app.put('/api/employees/batch', async (req, res) => {
  const updateData = req.body;
  console.log('PUT /api/employees/batch - 批量更新');
  console.log('请求数据类型:', Array.isArray(updateData) ? 'Array' : 'Object');
  console.log('请求数据:', JSON.stringify(updateData, null, 2));

  if (Array.isArray(updateData)) {
    console.log('检测到数组输入，逐个处理');
    let successCount = 0;
    let errorCount = 0;

    const updatePromises = updateData.map(async employee => {
      const employeeId = employee.id;
      console.log(`处理员工 ID: ${employeeId}`);

      if (!employeeId) {
        errorCount++;
        console.log(`缺少 ID，跳过: ${JSON.stringify(employee)}`);
        return { success: false, employee, error: 'Missing ID' };
      }

      try {
        console.log(`查找员工 ID: ${employeeId}`);
        const { data: existingData, error: findError } = await supabase
          .from('employees')
          .select('*')
          .eq('id', employeeId);

        if (findError) {
          errorCount++;
          console.log(`查找失败 ID ${employeeId}:`, findError.message);
          return { success: false, employee, error: findError.message };
        }

        console.log(`查找结果: ${existingData ? existingData.length : 0} 条`);

        const cleanedData = cleanEmployeeData(employee);
        console.log(`清理后的数据:`, cleanedData);

        if (!existingData || existingData.length === 0) {
          console.log(`员工不存在，插入新数据 ID: ${employeeId}`);

          if (!cleanedData._id) {
            cleanedData._id = uuidv4();
            console.log(`自动生成 _id:`, cleanedData._id);
          }

          const { data: insertData, error: insertError } = await supabase
            .from('employees')
            .insert(cleanedData)
            .select();

          if (insertError) {
            errorCount++;
            console.log(`插入失败 ID ${employeeId}:`, insertError.message);
            return { success: false, employee, error: insertError.message };
          } else {
            successCount++;
            console.log(`插入成功 ID: ${employeeId}`);
            return { success: true, employee: insertData[0] };
          }
        } else {
          console.log(`员工存在，更新数据 ID: ${employeeId}`);
          const { data: updateDataResult, error: updateError } = await supabase
            .from('employees')
            .update(cleanedData)
            .eq('id', employeeId)
            .select();

          if (updateError) {
            errorCount++;
            console.log(`更新失败 ID ${employeeId}:`, updateError.message);
            return { success: false, employee, error: updateError.message };
          } else {
            successCount++;
            console.log(`更新成功 ID: ${employeeId}`);
            return { success: true, employee: updateDataResult[0] };
          }
        }
      } catch (err) {
        errorCount++;
        console.log(`处理异常 ID ${employeeId}:`, err.message);
        return { success: false, employee, error: err.message };
      }
    });

    const results = await Promise.all(updatePromises);
    console.log(`批量处理完成: 成功 ${successCount} 条，失败 ${errorCount} 条`);

    try {
      const { data: allData, error: allError } = await supabase
        .from('employees')
        .select('*');

      if (allError) {
        return res.status(500).json({ error: 'Failed to get updated employee data' });
      }

      res.json({
        message: 'Batch update completed',
        success: successCount,
        failed: errorCount,
        data: allData
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to get updated employee data' });
    }
  } else {
    console.log('检测到对象输入，更新所有员工');
    try {
      const { data: allData, error: findAllError } = await supabase
        .from('employees')
        .select('*');

      if (findAllError) {
        return res.status(500).json({ error: 'Failed to query employee data' });
      }

      console.log(`找到 ${allData.length} 条员工数据`);

      if (allData.length === 0) {
        return res.json({
          message: 'No data to update',
          affected: 0,
          data: []
        });
      }

      const promises = allData.map(async (item) => {
        console.log(`更新员工 ID: ${item.id}`);
        const cleanedData = cleanEmployeeData(updateData);
        const { error: updateError } = await supabase
          .from('employees')
          .update(cleanedData)
          .eq('id', item.id);

        if (updateError) {
          console.log(`更新失败 ID ${item.id}:`, updateError.message);
        } else {
          console.log(`更新成功 ID: ${item.id}`);
        }
        return updateError;
      });

      const errors = await Promise.all(promises);
      const successCount = errors.filter(e => e === null).length;
      const errorCount = errors.filter(e => e !== null).length;

      const { data: updatedData, error: updatedError } = await supabase
        .from('employees')
        .select('*');

      if (updatedError) {
        return res.status(500).json({ error: 'Failed to get updated employee data' });
      }

      res.json({
        message: 'Batch update successful',
        affected: successCount,
        data: updatedData
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to batch update employee data' });
    }
  }
});

app.get('/api/employees/:id', async (req, res) => {
  const { id } = req.params;
  console.log(`GET /api/employees/${id} - 查询员工`);
  try {
    const { data, error } = await supabase.from('employees').select('*').eq('id', id);
    if (error) {
      console.error('查询失败:', error);
      return res.status(500).json({ error: 'Failed to get employee data' });
    }
    if (!data || data.length === 0) {
      console.log(`未找到员工 ID: ${id}`);
      return res.status(404).json({ error: 'Employee not found' });
    }
    console.log('查询结果:', data[0]);
    res.json(data[0]);
  } catch (error) {
    console.error('查询异常:', error);
    res.status(500).json({ error: 'Failed to get employee data' });
  }
});

app.put('/api/employees/:id', async (req, res) => {
  const { id } = req.params;
  const updateData = { ...req.body };
  console.log(`PUT /api/employees/${id} - 更新员工`);
  console.log('更新数据:', JSON.stringify(updateData, null, 2));
  try {
    const { data, error } = await supabase
      .from('employees')
      .update(updateData)
      .eq('id', id)
      .select();
    if (error) {
      console.error('更新失败:', error);
      return res.status(500).json({ error: 'Failed to update employee data' });
    }
    if (!data || data.length === 0) {
      console.log(`未找到员工 ID: ${id}`);
      return res.status(404).json({ error: 'Employee not found' });
    }
    console.log('更新成功:', data[0]);
    res.json(data[0]);
  } catch (error) {
    console.error('更新异常:', error);
    res.status(500).json({ error: 'Failed to update employee data' });
  }
});

app.delete('/api/employees/:id', async (req, res) => {
  const { id } = req.params;
  console.log(`DELETE /api/employees/${id} - 删除员工`);

  if (!id || id === 'null' || id === 'undefined') {
    console.log(`无效的 ID: ${id}`);
    return res.status(400).json({ error: 'Invalid ID' });
  }

  try {
    const { error } = await supabase.from('employees').delete().eq('_id', id);
    if (error) {
      console.error('删除失败:', error);
      return res.status(500).json({ error: 'Failed to delete employee data' });
    }
    console.log('删除成功');
    res.json({ message: 'Employee deleted successfully' });
  } catch (error) {
    console.error('删除异常:', error);
    res.status(500).json({ error: 'Failed to delete employee data' });
  }
});

// users 表相关API（原 users.db）

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  console.log(`POST /api/login - 登录请求: ${username}`);

  try {
    const { data: userData, error } = await supabase
      .from('users')
      .select('*')
      .eq('username', username)
      .eq('password', password)
      .single();

    if (error || !userData) {
      console.log('登录失败: 用户名或密码错误');
      return res.status(401).json({ error: '用户名或密码错误' });
    }

    console.log('登录成功:', userData.name);
    res.json({
      success: true,
      user: {
        id: userData.id,
        username: userData.username,
        name: userData.name,
        role: userData.role
      }
    });
  } catch (error) {
    console.error('登录异常:', error);
    res.status(500).json({ error: '登录失败' });
  }
});

app.get('/api/users', async (req, res) => {
  console.log('GET /api/users - 查询所有用户');
  try {
    const { data: usersData, error } = await supabase.from('users').select('*');
    if (error) {
      console.error('查询失败:', error);
      return res.status(500).json({ error: '获取用户列表失败' });
    }
    console.log('查询结果:', usersData.length, '条记录');
    const safeUsers = usersData.map(user => ({
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role
    }));
    res.json(safeUsers);
  } catch (error) {
    console.error('查询异常:', error);
    res.status(500).json({ error: '获取用户列表失败' });
  }
});

app.listen(port, () => {
  console.log(`服务器运行在 http://localhost:${port}`);
});
